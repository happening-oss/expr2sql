<p align="center">
  <img src="./logo.svg" height="250" width="250"/>
</p>

<h1 align="center">
  expr2sql
</h1>

<p align="center">
    <a href="https://goreportcard.com/report/happening-oss/expr2sql">
        <img src="https://goreportcard.com/badge/happening-oss/expr2sql" alt="Go Report"/></a>
    <a href="https://github.com/happening-oss/expr2sql/actions/workflows/lib-ci.yml">
        <img src="https://github.com/happening-oss/expr2sql/actions/workflows/lib-ci.yml/badge.svg" alt="Build Status"/></a>
    <a href="https://github.com/happening-oss/expr2sql/releases">
        <img src="https://img.shields.io/github/v/release/happening-oss/expr2sql?filter=v*" alt="Latest Release"/></a>
    <a href="https://github.com/happening-oss/expr2sql/blob/master/LICENSE">
        <img src="https://img.shields.io/github/license/happening-oss/expr2sql" alt="MIT License"/></a>
</p>

Translator of [Expr-lang](https://github.com/expr-lang/expr) expressions to SQL allowing the execution 
of expressions in the database for efficient dynamic data filtering. 
Current SQL support includes PostgreSQL dialect.

The project consists of:

- Golang library
- [Autocomplete filter builder component](./packages/editor) (Typescript)

# Features

- 🗨️ **expressive** 
    - most Expr-lang language operators are translated to SQL equivalents
- 🦺 **type-safe**
    - columns which can appear in the expression can be configured, with respective types
    - types of expression constants are resolved
    - each operation is validated for type compatibility
- 🔒 **secure**
    - input guarded by the Expr-lang parser (i.e. no injections)
      - only legitimate expressions within its grammar are allowed
    - output validated by the translator 
      - resulting SQL must be an expression with a boolean result for the `WHERE` clause
- 🌳 **JSON support**
    - allows for simple expressions on JSON columns
    - nesting supported

# Usage

### Supported literal types

- `boolean`
- `integer`
- `float`
- `string`
    - if in RFC3339 format, then the type is a `timestamp`
- `nil`

### Supported column types

- `boolean`
- `integer`
- `float`
- `string`
- `timestamp`
- `JSON`

### Supported operators:

| Type       | Operators                                                 |
|------------|-----------------------------------------------------------|
| Arithmetic | `+`, `-`, `*`, `/`, `%` (modulus), `^` or `**` (exponent) |
| Comparison | `==`, `!=`, `<`, `>`, `<=`, `>=`                          |
| Logical    | `not` or `!`, `and` or `&&`, `or` or `\|\|`               |
| Membership | `[]`, `.`                                                 |
| String     | `contains`, `startsWith`, `endsWith`                      |
| Regex      | `matches`                                                 |

# Getting started
Get latest library release:
```bash
go get github.com/happening-oss/expr2sql
```
Run example:
```go
package main

import (
	"fmt"

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

	for _, expr := range []string{
		`intField > 42 and stringField == 'stringValue'`,
		`floatField > 2.71828 or timestampField > '2024-12-01T00:00:00Z'`,
		`intField > intField2 * 2 and boolField1 or boolField2`,
		`jsonField.stringProp == "stringValue" or jsonField.boolProp`,
	} {
		translated, err := translator.Translate(expr)
		if err != nil {
			panic(err)
		}
		fmt.Println(translated)
	}
}

```
Output:

| Expr-lang                                                         | PostgreSQL                                                                                    |
|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `intField > 42 and stringField == 'stringValue'`                  | `((intField > 42) and (stringField = 'stringValue'))`                                         |
| `floatField > 2.71828 or timestampField > '2024-12-01T00:00:00Z'` | `((floatField > 2.71828) or (timestampField > '2024-12-01T00:00:00Z'))`                       |
| `intField > intField2 * 2 and boolField1 or boolField2`           | `(((intField > (intField2 * 2)) and boolField1) or bool_field2)`                              |
| `jsonField.stringProp == "stringValue" or jsonField.boolProp`     | `((jsonField ->> 'stringProp' = 'stringValue') or cast(jsonField ->> 'boolProp' as boolean))` |

### [Live demo](https://happening-oss.github.io/expr2sql)

## Autocomplete filter builder - expr2sql-editor

This library is accompanied by an useful [filter builder component](./packages/editor) you can use to build expressions in the browser.