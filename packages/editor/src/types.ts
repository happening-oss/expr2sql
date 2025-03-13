import { Token } from "./lexer/types";
import { OperatorInfo, TypeInfo } from "./parser";

export type ComponentParams = {
  value: Token | null | undefined;
  onInput(value: string, kind: string, close?: boolean): void;
  onKeyDown(e: KeyboardEvent): void;
}

export type Component = Partial<{
  update(value: Token): void;
  destroy(): void;
  focus(): void;
}>

export type ComponentCreator = (root: HTMLElement, args: ComponentParams) => Component;

export type CustomInputs = { [format: string]: ComponentCreator; }

export type Doc = {
  variables: Variables;
  operators?: Operators;
}

export type Variables = { [name: string]: TypeInfo; }
export type Operators = { [name: string]: OperatorInfo; }
