package filter_test

import (
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/happening-oss/expr2sql/pkg/filter"
)

func TestTranslator(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Translator")
}

var _ = Describe("Postgres translator", func() {
	var trs filter.Translator

	BeforeEach(func() {
		trs = filter.NewTranslator([]filter.Identifier{
			{ExprName: "intField", Type: filter.IdentifierTypeInt},
			{ExprName: "floatField", Type: filter.IdentifierTypeFloat},
			{ExprName: "boolField", Type: filter.IdentifierTypeBool},
			{ExprName: "stringField", Type: filter.IdentifierTypeString},
			{ExprName: "tsField", Type: filter.IdentifierTypeTimestamp},
			{ExprName: "jsonField", Type: filter.IdentifierTypeJSON, JSONSpec: filter.JSONTree{
				"nestedProperty1": filter.JSONTree{
					"nestedProperty2": filter.JSONTree{
						"stringProperty": filter.JSONLeaf(filter.IdentifierTypeString),
					},
				},
				"intProperty":    filter.JSONLeaf(filter.IdentifierTypeInt),
				"floatProperty":  filter.JSONLeaf(filter.IdentifierTypeFloat),
				"boolProperty":   filter.JSONLeaf(filter.IdentifierTypeBool),
				"stringProperty": filter.JSONLeaf(filter.IdentifierTypeString),
				"tsProperty":     filter.JSONLeaf(filter.IdentifierTypeTimestamp),
			}},
		}, filter.TranslatorDialectPostgres)
	})

	Describe("invalid expressions", func() {
		When("invalid syntax", func() {
			It("fails", func() {
				_, err := trs.Translate("intField = nil")

				Expect(err).To(HaveOccurred())
				Expect(filter.IsParsingError(err)).To(BeTrue())
			})
		})

		When("unknown identifier", func() {
			It("fails", func() {
				_, err := trs.Translate("someField == 2")

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnknownIdentifier(err)).To(BeTrue())
			})
		})

		When("unsupported operation", func() {
			It("fails for incompatible const types", func() {
				_, err := trs.Translate(`intField == "abcd" + 2`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnsupportedOperation(err)).To(BeTrue())
			})

			It("fails for incompatible identifier and const type", func() {
				_, err := trs.Translate(`intField + "abcd" == "1abcd"`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnsupportedOperation(err)).To(BeTrue())
			})

			It("fails for incompatible identifier types", func() {
				_, err := trs.Translate(`intField and boolField`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnsupportedOperation(err)).To(BeTrue())
			})
		})

		When("unsupported operator", func() {
			It("fails", func() {
				_, err := trs.Translate(`jsonField?.abcd`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnsupportedOperation(err)).To(BeTrue())
			})
		})

		When("unsupported json notation", func() {
			It("fails for unsupported syntax", func() {
				_, err := trs.Translate(`jsonField.3 == "abcd"`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsParsingError(err)).To(BeTrue())
			})

			It("fails for unsupported property type", func() {
				_, err := trs.Translate(`jsonField[3] == "abcd"`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnsupportedOperation(err)).To(BeTrue())
			})
		})

		When("invalid json path", func() {
			It("fails for unknown property", func() {
				_, err := trs.Translate(`jsonField.abcd == "abcd"`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnknownIdentifier(err)).To(BeTrue())
			})

			It("fails for unsupported operation on property", func() {
				_, err := trs.Translate(`jsonField.nestedProperty1 == "abcd"`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnsupportedOperation(err)).To(BeTrue())
			})

			It("fails for accessing property of a non-object", func() {
				_, err := trs.Translate(`jsonField.stringProperty.anotherOne == "abcd"`)

				Expect(err).To(HaveOccurred())
				Expect(filter.IsUnsupportedOperation(err)).To(BeTrue())
			})
		})

		When("non-boolean expression", func() {
			It("fails", func() {
				_, err := trs.Translate("intField + 2")

				Expect(err).To(HaveOccurred())
				Expect(err).To(Equal(filter.ErrInvalidFilter))
			})
		})
	})

	Describe("simple translation", func() {
		Describe("identifier translation", func() {
			It("translates nil", func() {
				query, err := trs.Translate("intField == nil")

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(intField IS NULL)")))
			})

			It("translates int", func() {
				query, err := trs.Translate("intField == 2")

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(intField = 2)")))
			})

			It("translates float", func() {
				query, err := trs.Translate("floatField == 1234.56789101112")

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(floatField = 1234.56789101112)")))
			})

			It("translates bool", func() {
				query, err := trs.Translate("boolField == true")

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(boolField = TRUE)")))
			})

			It("translates string", func() {
				query, err := trs.Translate(`stringField == "abcd"`)

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(stringField = 'abcd')")))
			})

			It("translates timestamp", func() {
				query, err := trs.Translate(`tsField < "2024-09-17T08:00:00Z"`)

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(tsField < '2024-09-17T08:00:00Z')")))
			})

			It("translates timestamp with timezones", func() {
				query, err := trs.Translate(`tsField < "2024-09-17T08:00:00+03:00"`)

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(tsField < '2024-09-17T05:00:00Z')")))
			})

			It("translates timestamp with nanos", func() {
				query, err := trs.Translate(`tsField < "2024-09-17T08:00:01.2345Z"`)

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("(tsField < '2024-09-17T08:00:01.2345Z')")))
			})
		})

		Describe("json translation", func() {
			When("nil expression", func() {
				It("translates nil string", func() {
					query, err := trs.Translate("jsonField.stringProperty == nil")

					Expect(err).ToNot(HaveOccurred())
					Expect(query).To(Equal(filter.SQLWhereCondition("(jsonField ->> 'stringProperty' IS NULL)")))
				})

				It("translates nil int", func() {
					query, err := trs.Translate("jsonField.intProperty == nil")

					Expect(err).ToNot(HaveOccurred())
					Expect(query).To(Equal(filter.SQLWhereCondition("(cast(jsonField ->> 'intProperty' as int) IS NULL)")))
				})

				It("translates nil float", func() {
					query, err := trs.Translate("jsonField.floatProperty == nil")

					Expect(err).ToNot(HaveOccurred())
					Expect(query).To(Equal(filter.SQLWhereCondition("(cast(jsonField ->> 'floatProperty' as float) IS NULL)")))
				})

				It("translates nil bool", func() {
					query, err := trs.Translate("jsonField.boolProperty == nil")

					Expect(err).ToNot(HaveOccurred())
					Expect(query).To(Equal(filter.SQLWhereCondition("(cast(jsonField ->> 'boolProperty' as boolean) IS NULL)")))
				})
			})

			It("translates string", func() {
				query, err := trs.Translate(`jsonField.stringProperty == "abcd"`)

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition(`(jsonField ->> 'stringProperty' = 'abcd')`)))
			})

			It("translates other primitive types", func() {
				query, err := trs.Translate("jsonField.intProperty <= 2 and jsonField.boolProperty == true")

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition("((cast(jsonField ->> 'intProperty' as int) <= 2) and (cast(jsonField ->> 'boolProperty' as boolean) = TRUE))")))
			})

			It("translates alternative json notation", func() {
				query, err := trs.Translate(`jsonField['stringProperty'] == "abcd"`)

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition(`(jsonField ->> 'stringProperty' = 'abcd')`)))
			})

			It("translates nested property", func() {
				query, err := trs.Translate(`jsonField.nestedProperty1.nestedProperty2.stringProperty == "abcd"`)

				Expect(err).ToNot(HaveOccurred())
				Expect(query).To(Equal(filter.SQLWhereCondition(`(jsonField -> 'nestedProperty1' -> 'nestedProperty2' ->> 'stringProperty' = 'abcd')`)))
			})
		})
	})

	Describe("expressions", func() {
		It("translates binary expressions", func() {
			query, err := trs.Translate(`intField >= 3 and jsonField.tsProperty > "2024-09-17T08:00:00Z"`)

			Expect(err).ToNot(HaveOccurred())
			Expect(query).To(Equal(filter.SQLWhereCondition("((intField >= 3) and (jsonField ->> 'tsProperty' > '2024-09-17T08:00:00Z'))")))
		})

		It("translates unary expressions", func() {
			query, err := trs.Translate(`!boolField and jsonField.intProperty == -2`)

			Expect(err).ToNot(HaveOccurred())
			Expect(query).To(Equal(filter.SQLWhereCondition("((not boolField) and (cast(jsonField ->> 'intProperty' as int) = (-2)))")))
		})

		It("translates math expressions", func() {
			query, err := trs.Translate(`jsonField.floatProperty >= floatField + 3 - 2`)

			Expect(err).ToNot(HaveOccurred())
			Expect(query).To(Equal(filter.SQLWhereCondition("(cast(jsonField ->> 'floatProperty' as float) >= ((floatField + 3) - 2))")))
		})

		It("translates string expressions", func() {
			query, err := trs.Translate(`(stringField startsWith "abcd" or stringField endsWith "abcd") and (jsonField.stringProperty matches "[A-Z]+" or jsonField.stringProperty contains "ijkl")`)

			Expect(err).ToNot(HaveOccurred())
			Expect(query).To(Equal(filter.SQLWhereCondition("(((stringField like 'abcd%%') or (stringField like '%%abcd')) and ((jsonField ->> 'stringProperty' ~ '[A-Z]+') or (jsonField ->> 'stringProperty' like '%%ijkl%%')))")))
		})
	})
})
