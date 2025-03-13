package filter

import "errors"

var ErrInvalidFilter = errors.New("invalid filter")

type ParsingError struct {
	Err error
}

func (e *ParsingError) Error() string {
	return "parsing_error: " + e.Err.Error()
}

func IsParsingError(err error) bool {
	if err == nil {
		return false
	}
	var e *ParsingError
	return errors.As(err, &e)
}

type UnknownIdentifierError struct {
	identifier string
}

func (e *UnknownIdentifierError) Error() string {
	return "unknown_identifier: " + e.identifier
}

func unknownIdentifier(identifier string) error {
	return &UnknownIdentifierError{identifier}
}

func IsUnknownIdentifier(err error) bool {
	if err == nil {
		return false
	}
	var e *UnknownIdentifierError
	return errors.As(err, &e)
}

type UnsupportedOperationError struct {
	op string
}

func (e *UnsupportedOperationError) Error() string {
	return "unsupported_operation: " + e.op
}

func unsupportedOperation(op string) error {
	return &UnsupportedOperationError{op}
}

func IsUnsupportedOperation(err error) bool {
	if err == nil {
		return false
	}
	var e *UnsupportedOperationError
	return errors.As(err, &e)
}
