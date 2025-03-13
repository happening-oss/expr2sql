package filter

import "github.com/happening-oss/expr2sql/pkg/filter/internal"

type IdentifierType internal.ExprType

const (
	IdentifierTypeInt       = IdentifierType(internal.ExprTypeIntIdentifier)
	IdentifierTypeFloat     = IdentifierType(internal.ExprTypeFloatIdentifier)
	IdentifierTypeBool      = IdentifierType(internal.ExprTypeBoolIdentifier)
	IdentifierTypeString    = IdentifierType(internal.ExprTypeStringIdentifier)
	IdentifierTypeTimestamp = IdentifierType(internal.ExprTypeTimestampIdentifier)
	IdentifierTypeJSON      = IdentifierType(internal.ExprTypeJSONIdentifier)
)

type JSONElement interface {
	IdentifierType() IdentifierType
}

type JSONTree map[string]JSONElement

func (l JSONTree) IdentifierType() IdentifierType {
	return IdentifierTypeJSON
}

type JSONLeaf IdentifierType

func (l JSONLeaf) IdentifierType() IdentifierType {
	return IdentifierType(l)
}

type Identifier struct {
	ExprName string
	DBName   string
	Type     IdentifierType
	JSONSpec JSONTree
}
