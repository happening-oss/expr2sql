package internal

type ExprType string

const (
	ExprTypeNil       ExprType = "expr_nil"
	ExprTypeInt       ExprType = "expr_int"
	ExprTypeFloat     ExprType = "expr_float"
	ExprTypeBool      ExprType = "expr_bool"
	ExprTypeString    ExprType = "expr_string"
	ExprTypeTimestamp ExprType = "expr_timestamp"

	ExprTypeIntIdentifier       ExprType = "int"
	ExprTypeFloatIdentifier     ExprType = "float"
	ExprTypeBoolIdentifier      ExprType = "bool"
	ExprTypeStringIdentifier    ExprType = "string"
	ExprTypeTimestampIdentifier ExprType = "timestamp"
	ExprTypeJSONIdentifier      ExprType = "json"
)

type TranslationResult struct {
	Expr string
	Type ExprType
}
