package main

import (
	"syscall/js"

	"github.com/happening-oss/expr2sql/pkg/filter"
)

func main() {
	identifiers := []filter.Identifier{
		{ExprName: "intField", Type: filter.IdentifierTypeInt},
		{ExprName: "intField2", Type: filter.IdentifierTypeInt},
		{ExprName: "stringField", Type: filter.IdentifierTypeString},
		{ExprName: "floatField", Type: filter.IdentifierTypeFloat},
		{ExprName: "timestampField", Type: filter.IdentifierTypeTimestamp},
		{ExprName: "boolField1", Type: filter.IdentifierTypeBool},
		{ExprName: "boolField2", Type: filter.IdentifierTypeBool, DBName: "bool_field2"},
		{ExprName: "jsonField", Type: filter.IdentifierTypeJSON, JSONSpec: filter.JSONTree{
			"stringProp": filter.JSONLeaf(filter.IdentifierTypeString),
			"boolProp":   filter.JSONLeaf(filter.IdentifierTypeBool),
		}},
	}

	translator := filter.NewTranslator(identifiers, filter.TranslatorDialectPostgres)

	js.Global().Set("translate", js.FuncOf(func(t js.Value, args []js.Value) any {
		if len(args) != 1 {
			return []interface{}{nil, "invalid args"}
		}
		expr := args[0].String()
		translated, err := translator.Translate(expr)
		if err != nil {
			return []interface{}{nil, err.Error()}
		}
		return []interface{}{string(translated), nil}
	}))

	<-make(chan struct{})
}
