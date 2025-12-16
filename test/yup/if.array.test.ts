import * as Yup from "yup";
import type { JSONSchema } from "../../src/schema";
import convertToYup from "../../src";
import { describe, expect, it } from "vitest";

describe("convertToYup() array conditions", () => {
  it("should validate all fields with exception to conditional fields", () => {
    const schema: JSONSchema = {
      type: "object",
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "test",
      title: "Test",
      properties: {
        list: {
          type: "array"
        }
      },
      required: ["list"],
      if: {
        properties: { list: { minItems: 3, type: "array" } }
      },
      then: {
        properties: {
          otherList: { type: "array" }
        }
      }
    };
    const yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    let isValid = yupschema.isValidSync({
      list: ["a", "b", "c"]
    });
    expect(isValid).toBeTruthy();
  });

  it("should validate conditional when dependency matches minimum items", () => {
    const schema: JSONSchema = {
      type: "object",
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "test",
      title: "Test",
      properties: {
        list: {
          type: "array"
        }
      },
      required: ["list"],
      if: {
        properties: { list: { minItems: 3, type: "array" } }
      },
      then: {
        properties: {
          otherList: { type: "array" }
        }
      }
    };
    const yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    let isValid = yupschema.isValidSync({
      list: ["a", "b", "c"],
      otherList: ["d"]
    });
    expect(isValid).toBeTruthy();

    yupschema.isValidSync({
      list: ["a", "b"]
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      list: ["a", "b", "c"],
      otherList: "A"
    });
    expect(isValid).toBeFalsy();

    isValid = yupschema.isValidSync({
      list: ["a", "b"],
      otherList: "A"
    });
    expect(isValid).toBeTruthy();
  });

  it("should validate conditional when dependency matches maximum items", () => {
    const schema: JSONSchema = {
      type: "object",
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "test",
      title: "Test",
      properties: {
        list: {
          type: "array"
        }
      },
      required: ["list"],
      if: {
        properties: { list: { maxItems: 3, type: "array" } }
      },
      then: {
        properties: {
          otherList: { type: "array" }
        }
      }
    };
    const yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    let isValid = yupschema.isValidSync({
      list: ["a", "b", "c"],
      otherList: ["d"]
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      list: ["a", "b", "c", "d"]
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      list: ["a", "b", "c"],
      otherList: "A"
    });
    expect(isValid).toBeFalsy();

    isValid = yupschema.isValidSync({
      list: ["a", "b", "c", "d", "e"],
      otherList: "A"
    });
    expect(isValid).toBeTruthy();
  });

  it("should validate an item of objects", () => {
    const schema: JSONSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "crs",
      description: "CRS",
      type: "object",
      properties: {
        isTaxResidentOnly: {
          type: "string"
        }
      },
      required: ["isTaxResidentOnly"],
      if: {
        properties: {
          isTaxResidentOnly: {
            type: "string",
            const: "false"
          }
        }
      },
      then: {
        properties: {
          countries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                country: {
                  type: "string",
                  description: "The country of the resident"
                },
                hasID: {
                  type: "string"
                }
              },
              required: ["country", "hasID"]
            },
            minItems: 1,
            maxItems: 5
          }
        },
        required: ["countries"]
      }
    };

    let yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;
    let isValid = yupschema.isValidSync({
      isTaxResidentOnly: "true",
      countries: [
        {
          country: "Singapore",
          idReason: "",
          idNoExplanation: ""
        }
      ]
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          idReason: "",
          idNoExplanation: "",
          hasID: "asdasdasd"
        }
      ]
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          idReason: "",
          idNoExplanation: ""
        }
      ]
    });
    expect(isValid).toBeFalsy();
  });

  it("should validate $ref items", () => {
    const schema: JSONSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "crs",
      description: "CRS",
      type: "object",
      definitions: {
        country: {
          type: "object",
          properties: {
            country: {
              type: "string"
            },
            hasID: {
              type: "string"
            }
          },
          required: ["country", "hasID"]
        }
      },
      properties: {
        isTaxResidentOnly: {
          type: "string"
        }
      },
      required: ["isTaxResidentOnly"],
      if: {
        properties: {
          isTaxResidentOnly: {
            type: "string",
            const: "false"
          }
        }
      },
      then: {
        properties: {
          countries: {
            type: "array",
            items: {
              $ref: "#/definitions/country"
            },
            minItems: 1,
            maxItems: 5
          }
        },
        required: ["countries"]
      }
    };

    let yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;
    let isValid = yupschema.isValidSync({
      isTaxResidentOnly: "true",
      countries: [
        {
          country: "Singapore"
        }
      ]
    });

    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "true"
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          hasID: "TEST"
        }
      ]
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          hasID: "TEST"
        },
        {
          country: "Singapore",
          hasID: "TEST"
        },
        {
          country: "Singapore",
          hasID: "TEST"
        },
        {
          country: "Singapore",
          hasID: "TEST"
        },
        {
          country: "Singapore",
          hasID: "TEST"
        },
        {
          country: "Singapore",
          hasID: "TEST"
        }
      ]
    });
    expect(isValid).toBeFalsy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: []
    });
    expect(isValid).toBeFalsy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore"
        }
      ]
    });
    expect(isValid).toBeFalsy();
  });

  it("should validate nested conditions if else", () => {
    const schema: JSONSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "crs",
      description: "CRS",
      type: "object",
      properties: {
        a: {
          type: "string"
        }
      },
      required: ["a"],
      if: {
        properties: {
          a: {
            const: "a"
          }
        }
      },
      then: {
        properties: {
          b: {
            type: "string"
          }
        },
        required: ["b"],
        if: {
          properties: {
            b: {
              const: "b"
            }
          }
        },
        then: {
          properties: {
            c: {
              type: "string"
            }
          },
          required: ["c"]
        },
        else: {
          properties: {
            d: {
              type: "string",
              minLength: 1
            }
          },
          required: ["d"]
        }
      },
      else: {
        properties: {
          e: {
            type: "string",
            minLength: 1
          }
        },
        required: ["e"]
      }
    };

    let yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    //TODO fix this test
    let isValid = false;
    let errorMessage;
    try {
      const value = {
        a: "1",
        b: "non"
        // e: "e"
        // b: "b"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      console.log(err);
      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
    }

    expect(isValid).toBeTruthy();
  });

  it("should validate nested conditions ifelse nested in else", () => {
    const schema: JSONSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "crs",
      description: "CRS",
      type: "object",
      properties: {
        a: {
          type: "string"
        }
      },
      required: ["a"],
      if: {
        properties: {
          a: {
            const: "a"
          }
        }
      },
      then: {
        properties: {
          b: {
            type: "string"
          }
        },
        required: ["b"]
      },
      else: {
        properties: {
          c: {
            type: "string"
          }
        },
        required: ["c"],
        if: {
          properties: {
            c: {
              const: "c"
            }
          }
        },
        then: {
          properties: {
            d: {
              type: "string"
            }
          },
          required: ["d"],
          if: {
            properties: {
              d: {
                const: "d"
              }
            }
          },
          then: {
            properties: {
              e: {
                type: "string"
              }
            },
            required: ["e"]
          },
          else: {
            properties: {
              f: {
                type: "string"
              }
            },
            required: ["f"]
          }
        },
        else: {
          properties: {
            g: {
              type: "string"
            }
          },
          required: ["g"]
        }
      }
    };

    let yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    //TODO fix this test
    let isValid = false;
    let errorMessage;
    try {
      const value = {
        a: "1",
        // b: "non"
        c: "c",
        d: "1",
        f: "d"
        // g: "g"
        // i: "g"
        // f: "g"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      console.log(err);
      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
      expect(err.path).toEqual("h");
    }

    expect(isValid).toBeFalsy();

    // try {
    //   const value = {
    //     a: "non",
    //     // b: "non"
    //     e: "non",
    //     g: "g",
    //     // h: "h"
    //     i: "i"
    //   };
    //   errorMessage = yupschema.validateSync(value);
    //   isValid = errorMessage ?? true;
    //   // isValid = yupschema.isValidSync(schema);
    // } catch (err) {
    //   isValid = false;
    //
    //   console.log(err);
    //   expect(err instanceof TypeError).toEqual(false);
    //   expect(err instanceof Yup.ValidationError).toEqual(true);
    // }
    //
    // expect(isValid).toBeTruthy();
  });

  it("should validate nested conditions deeply", () => {
    const schema: JSONSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "crs",
      description: "CRS",
      type: "object",
      properties: {
        step1: {
          type: "string"
        }
      },
      required: ["step1"],
      if: {
        properties: {
          step1: {
            const: "1"
          }
        }
      },
      then: {
        properties: {
          step2: {
            type: "string"
          }
        },
        required: ["step2"],
        if: {
          properties: {
            step2: {
              const: "2"
            }
          }
        },
        then: {
          properties: {
            step3: {
              type: "string"
            }
          },
          required: ["step3"],
          if: {
            properties: {
              step3: {
                const: "3"
              }
            }
          },
          then: {
            properties: {
              step4: {
                type: "string",
                minLength: 1
              }
            },
            required: ["step4"]
          }
        },
        else: {
          properties: {
            else: {
              type: "string",
              minLength: 1
            }
          },
          required: ["else"]
        }
      }
    };

    let yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    //TODO fix this test
    let isValid = false;
    let errorMessage;
    try {
      const value = {
        step1: "1",
        step2: "2",
        step3: "3",
        step4: "4"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      console.log(err);
      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
    }

    expect(isValid).toBeTruthy();

    try {
      const value = {
        step1: "1",
        step2: "test",
        step3: "3",
        step4: "4"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
    }

    expect(isValid).toBeTruthy();

    try {
      const value = {
        step1: "true",
        step2: "true",
        step3: "true",
        else: "test"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
    }

    expect(isValid).toBeTruthy();

    try {
      const value = {
        step1: "test",
        else: "test"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      console.log(err);
      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
    }

    expect(isValid).toBeTruthy();

    try {
      const value = {
        step1: "1",
        step2: "2"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      // console.log(err);
      // console.log(err.path);
      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
      expect(err.path).toEqual("step3");
    }

    expect(isValid).toBeFalsy();

    try {
      const value = {
        step1: "1"
      };
      errorMessage = yupschema.validateSync(value);
      isValid = errorMessage ?? true;
      // isValid = yupschema.isValidSync(schema);
    } catch (err) {
      isValid = false;

      // console.log(err);
      // console.log(err.path);
      expect(err instanceof TypeError).toEqual(false);
      expect(err instanceof Yup.ValidationError).toEqual(true);
      expect(err.path).toEqual("step2");
    }

    expect(isValid).toBeFalsy();
  });

  it("should validate nested conditions", () => {
    const schema: JSONSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "crs",
      description: "CRS",
      type: "object",
      definitions: {
        country: {
          type: "object",
          properties: {
            country: {
              type: "string",
              minLength: 1,
              maxLength: 30
            },
            hasID: {
              type: "string",
              minLength: 1,
              maxLength: 8
            }
          },
          required: ["country", "hasID"],
          if: {
            properties: {
              hasID: {
                const: "true"
              }
            }
          },
          then: {
            properties: {
              id: {
                type: "string",
                minLength: 1,
                maxLength: 8
              }
            },
            required: ["id"]
          },
          else: {
            properties: {
              idReason: {
                description: "niet goed",
                type: "string",
                minLength: 1,
                maxLength: 50
              }
            },
            required: ["idReason"],
            if: {
              properties: {
                idReason: {
                  const: "UNOBTAINABLE"
                }
              }
            },
            then: {
              properties: {
                idNoExplanation: {
                  type: "string",
                  minLength: 1,
                  maxLength: 8
                }
              },
              required: ["idNoExplanation"]
            }
          }
        }
      },
      properties: {
        isTaxResidentOnly: {
          type: "string"
        }
      },
      required: ["isTaxResidentOnly"],
      if: {
        properties: {
          isTaxResidentOnly: {
            type: "string",
            const: "false"
          }
        }
      },
      then: {
        properties: {
          countries: {
            type: "array",
            items: {
              $ref: "#/definitions/country"
            },
            minItems: 1,
            maxItems: 5
          }
        },
        required: ["countries"]
      }
    };

    let yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    let isValid;

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          hasID: "true",
          id: "TEST"
        }
      ]
    });

    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          hasID: "false",
          idReason: "TEST"
        }
      ]
    });

    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          hasID: "false"
        }
      ]
    });

    expect(isValid).toBeFalsy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          hasID: "false",
          idReason: "UNOBTAINABLE"
        }
      ]
    });

    expect(isValid).toBeFalsy();

    isValid = yupschema.isValidSync({
      isTaxResidentOnly: "false",
      countries: [
        {
          country: "Singapore",
          hasID: "false",
          idReason: "UNOBTAINABLE",
          idNoExplanation: "TEST"
        }
      ]
    });

    expect(isValid).toBeTruthy();
  });

  it("should validate multiple types", () => {
    const schema: JSONSchema = {
      type: "object",
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "test",
      title: "Test",
      properties: {
        list: {
          type: ["array", "null"]
        }
      }
    };
    const yupschema = convertToYup(schema) as Yup.ObjectSchema<object>;

    let isValid = yupschema.isValidSync({
      list: ["a"]
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      list: null
    });
    expect(isValid).toBeTruthy();

    isValid = yupschema.isValidSync({
      list: ""
    });
    expect(isValid).toBeTruthy();
  });
});
