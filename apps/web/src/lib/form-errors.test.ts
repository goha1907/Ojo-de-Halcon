import { createTranslator } from "@ojo/shared";
import { describe, expect, it } from "vitest";
import { issuesToFieldErrors } from "./form-errors";

describe("issuesToFieldErrors", () => {
  const t = createTranslator("ru");

  it("keeps the first translated message per field", () => {
    const errors = issuesToFieldErrors(
      [
        { path: ["firstName"], message: "validation.required" },
        { path: ["firstName"], message: "validation.nameInvalid" },
        { path: ["birthDate"], message: "validation.birthDateFuture" },
      ],
      t,
    );
    expect(errors).toEqual({
      firstName: "Обязательное поле",
      birthDate: "Дата рождения не может быть в будущем",
    });
  });

  it("passes unknown messages through and tolerates empty paths", () => {
    expect(issuesToFieldErrors([{ path: [], message: "Something custom" }], t)).toEqual({
      _form: "Something custom",
    });
  });
});
