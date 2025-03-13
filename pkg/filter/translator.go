package filter

type TranslatorDialect byte

const (
	TranslatorDialectPostgres TranslatorDialect = iota + 1
)

func NewTranslator(allowedIdentifiers []Identifier, _ TranslatorDialect) Translator {
	return newPostgresTranslator(allowedIdentifiers)
}

type SQLWhereCondition string

type Translator interface {
	Translate(query string) (SQLWhereCondition, error)
}
