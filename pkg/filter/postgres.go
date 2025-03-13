package filter

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/parser"

	"github.com/happening-oss/expr2sql/pkg/filter/internal"
)

var unaryOperators = map[string]internal.UnaryOperatorDescriptor{
	"!":   internal.UnaryBooleanOperatorDescriptor("not"),
	"not": internal.UnaryBooleanOperatorDescriptor("not"),
	"-":   internal.UnaryNumericOperatorDescriptor("-"),
}

var binaryOperators = map[string]internal.BinaryOperatorDescriptor{
	"+":  internal.NumericOperatorDescriptor("+"),
	"-":  internal.NumericOperatorDescriptor("-"),
	"*":  internal.NumericOperatorDescriptor("*"),
	"/":  internal.NumericOperatorDescriptor("/"),
	"%":  internal.NumericOperatorDescriptor("%"),
	"**": internal.NumericOperatorDescriptor("^"),
	"^":  internal.NumericOperatorDescriptor("^"),

	"==": internal.NillableComparisonOperatorDescriptor("=", "IS"),
	"!=": internal.NillableComparisonOperatorDescriptor("<>", "IS NOT"),
	"<":  internal.ComparisonOperatorDescriptor("<"),
	">":  internal.ComparisonOperatorDescriptor(">"),
	"<=": internal.ComparisonOperatorDescriptor("<="),
	">=": internal.ComparisonOperatorDescriptor(">="),

	"&&":  internal.BooleanOperatorDescriptor("and"),
	"and": internal.BooleanOperatorDescriptor("and"),
	"||":  internal.BooleanOperatorDescriptor("or"),
	"or":  internal.BooleanOperatorDescriptor("or"),

	"contains":   internal.StringLikeOperatorDescriptor("%%", "%%"),
	"startsWith": internal.StringLikeOperatorDescriptor("", "%%"),
	"endsWith":   internal.StringLikeOperatorDescriptor("%%", ""),
	"matches": {
		TypeConstraints: []internal.BinaryOperatorTypeConstraint{
			{Left: internal.ExprTypeStringIdentifier, Right: internal.ExprTypeString},
		},
		OpTranslator: func(left, right internal.TranslationResult) internal.TranslationResult {
			return internal.TranslationResult{
				Expr: fmt.Sprintf("%v ~ %v", left.Expr, right.Expr),
				Type: internal.ExprTypeBool,
			}
		},
	},
}

type postgresTranslator struct {
	allowedIdentifiers []Identifier
}

func newPostgresTranslator(allowedIdentifiers []Identifier) *postgresTranslator {
	return &postgresTranslator{allowedIdentifiers}
}

func (t *postgresTranslator) Translate(query string) (SQLWhereCondition, error) {
	parsed, err := parser.Parse(query)
	if err != nil {
		return "", &ParsingError{err}
	}
	result, err := t.translate(parsed.Node)
	if err != nil {
		return "", err
	}
	if result.Type != internal.ExprTypeBool && result.Type != internal.ExprTypeBoolIdentifier {
		return "", ErrInvalidFilter
	}
	return SQLWhereCondition(result.Expr), nil
}

func (t *postgresTranslator) translate(node ast.Node) (translated internal.TranslationResult, err error) {
	switch typed := node.(type) {
	case *ast.NilNode:
		return internal.TranslationResult{Expr: "NULL", Type: internal.ExprTypeNil}, nil
	case *ast.IdentifierNode:
		translated, _, err = t.translateIdentifier(typed)
		return translated, err
	case *ast.StringNode:
		exprType := internal.ExprTypeString
		t, err := time.Parse(time.RFC3339Nano, typed.Value) // special case for timestamp strings
		if err == nil {
			typed.Value = t.UTC().Format(time.RFC3339Nano) // adjust valid timestamp to UTC in case DB column does not use time zones
			exprType = internal.ExprTypeTimestamp
		}
		typed.Value = strings.ReplaceAll(typed.Value, "'", "''")
		return internal.TranslationResult{Expr: fmt.Sprintf(`'%v'`, typed.Value), Type: exprType}, nil
	case *ast.IntegerNode:
		return internal.TranslationResult{Expr: strconv.Itoa(typed.Value), Type: internal.ExprTypeInt}, nil
	case *ast.FloatNode:
		return internal.TranslationResult{Expr: strconv.FormatFloat(typed.Value, 'G', -1, 64), Type: internal.ExprTypeFloat}, nil
	case *ast.BoolNode:
		return internal.TranslationResult{Expr: strings.ToUpper(strconv.FormatBool(typed.Value)), Type: internal.ExprTypeBool}, nil
	case *ast.BinaryNode:
		leftExpr, err := t.translate(typed.Left)
		if err != nil {
			return internal.TranslationResult{}, err
		}
		rightExpr, err := t.translate(typed.Right)
		if err != nil {
			return internal.TranslationResult{}, err
		}
		return t.translateBinaryOperator(typed.Operator, leftExpr, rightExpr)
	case *ast.UnaryNode:
		expr, err := t.translate(typed.Node)
		if err != nil {
			return internal.TranslationResult{}, err
		}
		return t.translateUnaryOperator(typed.Operator, expr)
	case *ast.MemberNode:
		translated, _, err = t.translateJSON(typed)
		return translated, err
	default:
		return internal.TranslationResult{}, unsupportedOperation(fmt.Sprintf("%v", node))
	}
}

func (t *postgresTranslator) translateJSON(node ast.Node) (internal.TranslationResult, JSONElement, error) {
	switch typed := node.(type) {
	case *ast.IdentifierNode:
		return t.translateIdentifier(typed)
	case *ast.MemberNode:
		name, jsonEl, err := t.translateJSON(typed.Node)
		if err != nil {
			return internal.TranslationResult{}, nil, err
		}
		property, ok := typed.Property.(*ast.StringNode)
		if !ok {
			return internal.TranslationResult{}, nil, unsupportedOperation(fmt.Sprintf("json key needs to be string, instead found %v", typed.Property))
		}
		if _, ok := jsonEl.(JSONTree); !ok || jsonEl.IdentifierType() != IdentifierTypeJSON || name.Type != internal.ExprTypeJSONIdentifier {
			return internal.TranslationResult{}, nil, unsupportedOperation(fmt.Sprintf("value at '%v' is not a json object", typed.Node))
		}
		jsonEl, ok = jsonEl.(JSONTree)[property.Value]
		if !ok {
			return internal.TranslationResult{}, nil, unknownIdentifier(fmt.Sprintf("json object at '%v' does not contain field '%v'", typed.Node, property.Value))
		}
		expr := typedJSONExpr(name.Expr, property.Value, internal.ExprType(jsonEl.IdentifierType()))
		return internal.TranslationResult{Expr: expr, Type: internal.ExprType(jsonEl.IdentifierType())}, jsonEl, nil
	default:
		return internal.TranslationResult{}, nil, unsupportedOperation(fmt.Sprintf("json %v", node))
	}
}

var primitiveTypeCast = map[internal.ExprType]string{
	internal.ExprTypeIntIdentifier:   "int",
	internal.ExprTypeFloatIdentifier: "float",
	internal.ExprTypeBoolIdentifier:  "boolean",
}

func typedJSONExpr(object, key string, exprType internal.ExprType) string {
	if exprType == internal.ExprTypeStringIdentifier || exprType == internal.ExprTypeTimestampIdentifier {
		return fmt.Sprintf("%v ->> '%v'", object, key)
	}
	if t, ok := primitiveTypeCast[exprType]; ok {
		return fmt.Sprintf("cast(%v ->> '%v' as %v)", object, key, t)
	}
	return fmt.Sprintf("%v -> '%v'", object, key)
}

func (t *postgresTranslator) translateIdentifier(node *ast.IdentifierNode) (translated internal.TranslationResult, jsonEl JSONElement, err error) {
	index := slices.IndexFunc(t.allowedIdentifiers, func(id Identifier) bool {
		return id.ExprName == node.Value
	})
	if index == -1 {
		return internal.TranslationResult{}, nil, unknownIdentifier(node.Value)
	}
	name := node.Value
	identifier := t.allowedIdentifiers[index]
	if identifier.DBName != "" {
		name = identifier.DBName
	}
	return internal.TranslationResult{Expr: name, Type: internal.ExprType(identifier.Type)}, identifier.JSONSpec, nil
}

func (t *postgresTranslator) translateBinaryOperator(op string, leftExpr, rightExpr internal.TranslationResult) (internal.TranslationResult, error) {
	descriptor, ok := binaryOperators[op]
	if !ok ||
		len(descriptor.TypeConstraints) > 0 &&
			!slices.Contains(descriptor.TypeConstraints, internal.BinaryOperatorTypeConstraint{Left: leftExpr.Type, Right: rightExpr.Type}) {
		return internal.TranslationResult{}, unsupportedOperation(fmt.Sprintf("%v %v %v", leftExpr.Expr, op, rightExpr.Expr))
	}
	result := descriptor.OpTranslator(leftExpr, rightExpr)
	result.Expr = fmt.Sprintf("(%v)", result.Expr)
	return result, nil
}

func (t *postgresTranslator) translateUnaryOperator(op string, expr internal.TranslationResult) (internal.TranslationResult, error) {
	descriptor, ok := unaryOperators[op]
	if !ok || len(descriptor.TypeConstraints) > 0 && !slices.Contains(descriptor.TypeConstraints, expr.Type) {
		return internal.TranslationResult{}, unsupportedOperation(fmt.Sprintf("%v%v", op, expr.Expr))
	}
	result := descriptor.OpTranslator(expr)
	result.Expr = fmt.Sprintf("(%v)", result.Expr)
	return result, nil
}
