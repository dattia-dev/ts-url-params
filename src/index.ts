interface Params<I, O> {
  parse(url: string): O;
  // construct(params: C): T;
}
type ParsedParams = Record<ParamName, Value | undefined>;
type ParamsOptions = Record<ParamName, Type>;
type ParamName = string; // TODO: constrain further?
type TypeName = "string" | "number" | "boolean";
type Value = ValueOf<TypeName>;
type TypeDesc<T extends TypeName, V extends ValueOf<T>> = T | OptionalType<T> | TypeWithDefault<T, V>;
type Type = TypeDesc<"string", string> | TypeDesc<"number", number> | TypeDesc<"boolean", boolean>;
type OptionalType<T extends Type = any> = `${T}?`;
type TypeWithDefault<T extends TypeName, V extends ValueOf<T>> = `${T}=${V}`;
type ValueOf<T> =
  T extends ParamsOptions ? { [key in keyof T]: ValueOf<T[key]> } :
  T extends "string" ? string :
  T extends "number" ? number :
  T extends "boolean" ? boolean :
  T extends OptionalType<infer V> ? ValueOf<V> | undefined :
  T extends TypeWithDefault<infer V, any> ? ValueOf<V> :
  never;

function params<T extends ParamsOptions, V extends ValueOf<T>>(options: T): Params<V, V> {
  return new ParamsImpl(options);
}

interface ParamOptions {
  readonly type: TypeName;
  readonly modifier: "?" | "=" | undefined;
  readonly defaultValue: any;
}

const INVALID_VALUE = Symbol("INVALID");

class ParamsImpl<T extends ParsedParams> implements Params<T, T> {
  private names: ParamName[] = [];
  private readonly params: Record<ParamName, ParamOptions> = {};

  constructor(options: ParamsOptions) {
    for (const name of Object.keys(options)) {
      const value = options[name as keyof object];
      const typeOptions = this.descriptionToOptions(value);
      if (!typeOptions) throw `invalid property value: ${name}: ${value} `;
      this.names.push(name);
      this.params[name] = typeOptions;
    }
    this.names.sort();
  }

  parse(url: string) {
    const params = new URL(url).searchParams;
    const result: T = {} as any;
    for (const name of this.names) {
      const { type, modifier, defaultValue } = this.params[name];
      const rawValue = params.get(name);
      let value: T | undefined;
      if (rawValue) value = this.parseValue(rawValue, type) as any;
      else if (modifier === "=") value = defaultValue;
      else if (!modifier) throw `missing param: ${name} `;
      if (value != undefined) result[name as keyof T] = value as any;
    }
    return result;
  }

  parseValue(value: string, type: TypeName) {
    function onInvalid() { throw `could not parse ${type}: ${value} `; }
    switch (type) {
      case "string": return value;
      case "number": {
        const number = Number(value);
        if (isNaN(number)) onInvalid();
        return number;
      }
      case "boolean": {
        switch (value) {
          case "true": return true;
          case "false": return false;
        }
      }
    }
    throw onInvalid();
  }

  descriptionToOptions(desc: Type): ParamOptions | undefined {
    const match = /(string|number|boolean)(?:([?=])(.*))?/.exec(desc);
    if (!match) return;
    const type: "string" | "number" | "boolean" = match[1] as any;
    const modifier: "?" | "=" | undefined = match[2] as any;
    const defaultValue = (() => {
      if (modifier !== "=") return;
      return this.parseValue(match[3], type);
    })();
    return { type, modifier, defaultValue };
  }
}

try {
  const parsed = params({
    clientId: "number?",
    caseId: "number",
    typeId: "number=-1",
    type: "string=DefaultType",
    debug: "boolean=true"
  }).parse("https://www.example.com/api/endpoint?caseId=4&clientId=7h2");

  console.log(parsed);
} catch (e) { console.error(e); }
