package internal

import (
	"fmt"
	"slices"
)

type BinaryOperatorTypeConstraint struct {
	Left  ExprType
	Right ExprType
}

type BinaryOperatorDescriptor struct {
	TypeConstraints []BinaryOperatorTypeConstraint
	OpTranslator    func(left, right TranslationResult) TranslationResult
}

func ComparisonOperatorDescriptor(op string) BinaryOperatorDescriptor {
	return BinaryOperatorDescriptor{
		TypeConstraints: []BinaryOperatorTypeConstraint{
			{Left: ExprTypeIntIdentifier, Right: ExprTypeInt},
			{Left: ExprTypeFloatIdentifier, Right: ExprTypeFloat},
			{Left: ExprTypeStringIdentifier, Right: ExprTypeString},
			{Left: ExprTypeTimestampIdentifier, Right: ExprTypeTimestamp},
		},
		OpTranslator: func(left, right TranslationResult) TranslationResult {
			return TranslationResult{
				Expr: fmt.Sprintf("%v %v %v", left.Expr, op, right.Expr),
				Type: ExprTypeBool,
			}
		},
	}
}

// NillableComparisonOperatorDescriptor is a special ComparisonOperatorDescriptor which handles NULL comparison
func NillableComparisonOperatorDescriptor(op, nilOp string) BinaryOperatorDescriptor {
	return BinaryOperatorDescriptor{
		TypeConstraints: []BinaryOperatorTypeConstraint{
			{Left: ExprTypeIntIdentifier, Right: ExprTypeNil},
			{Left: ExprTypeFloatIdentifier, Right: ExprTypeNil},
			{Left: ExprTypeBoolIdentifier, Right: ExprTypeNil},
			{Left: ExprTypeStringIdentifier, Right: ExprTypeNil},
			{Left: ExprTypeTimestampIdentifier, Right: ExprTypeNil},

			{Left: ExprTypeIntIdentifier, Right: ExprTypeInt},
			{Left: ExprTypeFloatIdentifier, Right: ExprTypeFloat},
			{Left: ExprTypeBoolIdentifier, Right: ExprTypeBool},
			{Left: ExprTypeStringIdentifier, Right: ExprTypeString},
			{Left: ExprTypeTimestampIdentifier, Right: ExprTypeTimestamp},
		},
		OpTranslator: func(left, right TranslationResult) TranslationResult {
			var actualOp = op
			if right.Type == ExprTypeNil {
				actualOp = nilOp
			}
			return TranslationResult{
				Expr: fmt.Sprintf("%v %v %v", left.Expr, actualOp, right.Expr),
				Type: ExprTypeBool,
			}
		},
	}
}

func BooleanOperatorDescriptor(op string) BinaryOperatorDescriptor {
	return BinaryOperatorDescriptor{
		TypeConstraints: []BinaryOperatorTypeConstraint{
			{Left: ExprTypeBoolIdentifier, Right: ExprTypeBool},
			{Left: ExprTypeBoolIdentifier, Right: ExprTypeBoolIdentifier},
			{Left: ExprTypeBool, Right: ExprTypeBool},
			{Left: ExprTypeBool, Right: ExprTypeBoolIdentifier},
		},
		OpTranslator: func(left, right TranslationResult) TranslationResult {
			return TranslationResult{
				Expr: fmt.Sprintf("%v %v %v", left.Expr, op, right.Expr),
				Type: ExprTypeBool,
			}
		},
	}
}

func NumericOperatorDescriptor(op string) BinaryOperatorDescriptor {
	intExprs := []ExprType{ExprTypeIntIdentifier, ExprTypeInt}
	return BinaryOperatorDescriptor{
		TypeConstraints: []BinaryOperatorTypeConstraint{
			{Left: ExprTypeIntIdentifier, Right: ExprTypeIntIdentifier},
			{Left: ExprTypeIntIdentifier, Right: ExprTypeFloatIdentifier},
			{Left: ExprTypeFloatIdentifier, Right: ExprTypeIntIdentifier},
			{Left: ExprTypeFloatIdentifier, Right: ExprTypeFloatIdentifier},

			{Left: ExprTypeIntIdentifier, Right: ExprTypeInt},
			{Left: ExprTypeIntIdentifier, Right: ExprTypeFloat},
			{Left: ExprTypeFloatIdentifier, Right: ExprTypeInt},
			{Left: ExprTypeFloatIdentifier, Right: ExprTypeFloat},

			{Left: ExprTypeInt, Right: ExprTypeInt},
			{Left: ExprTypeInt, Right: ExprTypeFloat},
			{Left: ExprTypeFloat, Right: ExprTypeInt},
			{Left: ExprTypeFloat, Right: ExprTypeFloat},
		},
		OpTranslator: func(left, right TranslationResult) TranslationResult {
			resultType := ExprTypeFloat
			if slices.Contains(intExprs, left.Type) && slices.Contains(intExprs, right.Type) {
				resultType = ExprTypeInt
			}
			return TranslationResult{
				Expr: fmt.Sprintf("%v %v %v", left.Expr, op, right.Expr),
				Type: resultType,
			}
		},
	}
}

func StringLikeOperatorDescriptor(prefix, suffix string) BinaryOperatorDescriptor {
	return BinaryOperatorDescriptor{
		TypeConstraints: []BinaryOperatorTypeConstraint{
			{Left: ExprTypeStringIdentifier, Right: ExprTypeString},
		},
		OpTranslator: func(left, right TranslationResult) TranslationResult {
			return TranslationResult{
				Expr: fmt.Sprintf("%v like '%v%v%v'", left.Expr, prefix, right.Expr[1:len(right.Expr)-1], suffix),
				Type: ExprTypeBool,
			}
		},
	}
}

type UnaryOperatorDescriptor struct {
	TypeConstraints []ExprType
	OpTranslator    func(nested TranslationResult) TranslationResult
}

func UnaryBooleanOperatorDescriptor(op string) UnaryOperatorDescriptor {
	return UnaryOperatorDescriptor{
		TypeConstraints: []ExprType{ExprTypeBoolIdentifier, ExprTypeBool},
		OpTranslator: func(expr TranslationResult) TranslationResult {
			return TranslationResult{
				Expr: fmt.Sprintf("%v %v", op, expr.Expr),
				Type: ExprTypeBool,
			}
		},
	}
}

func UnaryNumericOperatorDescriptor(op string) UnaryOperatorDescriptor {
	return UnaryOperatorDescriptor{
		TypeConstraints: []ExprType{ExprTypeInt, ExprTypeFloat},
		OpTranslator: func(expr TranslationResult) TranslationResult {
			return TranslationResult{
				Expr: fmt.Sprintf("%v%v", op, expr.Expr),
				Type: expr.Type,
			}
		},
	}
}
