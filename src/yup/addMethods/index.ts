import * as Yup from "yup";
import {
  minimumItems,
  maximumItems,
  contains,
  tuple,
  uniqueItems
} from "./array";
import { multipleOf } from "./number";
import { urlReference } from "./string";
import { constant, enums } from "./mixed";
import { JSONSchemaDefinitionExtended } from "../../schema";
import { JSONSchema7Type } from "json-schema";
// Array methods

Yup.addMethod<
  Yup.ArraySchema<
    unknown[] | undefined,
    Yup.Maybe<Yup.AnyObject>,
    undefined,
    ""
  >
>(Yup.array, "minimumItems", minimumItems);

Yup.addMethod<
  Yup.ArraySchema<
    unknown[] | undefined,
    Yup.Maybe<Yup.AnyObject>,
    undefined,
    ""
  >
>(Yup.array, "maximumItems", maximumItems);

Yup.addMethod<
  Yup.ArraySchema<
    unknown[] | undefined,
    Yup.Maybe<Yup.AnyObject>,
    undefined,
    ""
  >
>(Yup.array, "contains", contains);

Yup.addMethod<
  Yup.ArraySchema<
    JSONSchemaDefinitionExtended[] | undefined,
    Yup.Maybe<Yup.AnyObject>,
    undefined,
    ""
  >
>(Yup.array, "tuple", tuple);

Yup.addMethod<
  Yup.ArraySchema<
    unknown[] | undefined,
    Yup.Maybe<Yup.AnyObject>,
    undefined,
    ""
  >
>(Yup.array, "uniqueItems", uniqueItems);

// Number methods

Yup.addMethod<Yup.NumberSchema>(Yup.number, "multipleOf", multipleOf);

// String methods

Yup.addMethod<Yup.StringSchema>(Yup.string, "urlReference", urlReference);

// Mixed methods

Yup.addMethod<Yup.MixedSchema>(Yup.mixed, "constant", constant);

Yup.addMethod<Yup.MixedSchema<JSONSchema7Type[] | undefined>>(
  Yup.mixed,
  "enum",
  enums
);

export default Yup;
