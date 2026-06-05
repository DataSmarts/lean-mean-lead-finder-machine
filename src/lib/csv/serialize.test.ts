import { describe, expect, it } from "vitest";

import { escapeField, guardFormula, toCsv, toCsvRow } from "./serialize";

describe("guardFormula", () => {
  it("leaves ordinary strings unchanged", () => {
    expect(guardFormula("hello")).toBe("hello");
    expect(guardFormula("John Smith")).toBe("John Smith");
    expect(guardFormula("john@example.com")).toBe("john@example.com");
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])("prefixes leading %s with a single-quote", (ch) => {
    expect(guardFormula(`${ch}cmd`)).toBe(`'${ch}cmd`);
  });

  it("does not prefix when the risky character is not the first character", () => {
    expect(guardFormula("a=b")).toBe("a=b");
    expect(guardFormula("a+b")).toBe("a+b");
  });

  it("prefixes a standalone risky character", () => {
    expect(guardFormula("=")).toBe("'=");
    expect(guardFormula("@")).toBe("'@");
  });
});

describe("escapeField", () => {
  it("returns empty string for null", () => {
    expect(escapeField(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeField(undefined)).toBe("");
  });

  it("returns empty string for the empty string", () => {
    expect(escapeField("")).toBe("");
  });

  it("leaves plain values unquoted", () => {
    expect(escapeField("hello")).toBe("hello");
    expect(escapeField("John Smith")).toBe("John Smith");
  });

  it("quotes a value containing a comma", () => {
    expect(escapeField("Smith, John")).toBe('"Smith, John"');
  });

  it("quotes a value containing a double-quote and doubles it", () => {
    expect(escapeField('say "hi"')).toBe('"say ""hi"""');
  });

  it("handles a lone double-quote", () => {
    expect(escapeField('"')).toBe('""""');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes a value containing a carriage return", () => {
    expect(escapeField("line1\rline2")).toBe('"line1\rline2"');
  });

  it("quotes a value containing CRLF", () => {
    expect(escapeField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("applies formula guard before quoting (e.g. =SUM becomes '=SUM, unquoted)", () => {
    expect(escapeField("=SUM(A1)")).toBe("'=SUM(A1)");
  });

  it("applies formula guard and then quotes if the guarded value needs quoting", () => {
    // '=foo,bar → needs quoting because of the comma
    expect(escapeField("=foo,bar")).toBe(`"'=foo,bar"`);
  });

  it("passes unicode through unchanged", () => {
    expect(escapeField("Ángel López")).toBe("Ángel López");
    expect(escapeField("北京")).toBe("北京");
  });
});

describe("toCsvRow", () => {
  it("joins fields with commas", () => {
    expect(toCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("handles null and undefined in the fields array", () => {
    expect(toCsvRow(["a", null, undefined, "d"])).toBe("a,,,d");
  });

  it("quotes fields that need quoting", () => {
    expect(toCsvRow(["Smith, John", "CEO"])).toBe('"Smith, John",CEO');
  });

  it("produces an empty row for an empty array", () => {
    expect(toCsvRow([])).toBe("");
  });

  it("produces a single-field row with no trailing comma", () => {
    expect(toCsvRow(["only"])).toBe("only");
  });
});

describe("toCsv", () => {
  const HEADER = ["Name", "Email", "Title"];
  const ROWS: ReadonlyArray<ReadonlyArray<string | null>> = [
    ["John Smith", "john@example.com", "CEO"],
    ["Jane Doe", "jane@example.com", "CTO"],
  ];

  it("produces a header row + data rows separated by CRLF", () => {
    const result = toCsv(HEADER, ROWS);
    expect(result).toBe(
      "Name,Email,Title\r\nJohn Smith,john@example.com,CEO\r\nJane Doe,jane@example.com,CTO\r\n",
    );
  });

  it("produces header-only output when rows is empty", () => {
    expect(toCsv(HEADER, [])).toBe("Name,Email,Title\r\n");
  });

  it("uses CRLF terminators (RFC-4180) not bare LF", () => {
    const result = toCsv(["A"], [["1"], ["2"]]);
    expect(result).toBe("A\r\n1\r\n2\r\n");
    expect(result).not.toContain("\n\n");
  });

  it("applies escaping to header fields that contain special characters", () => {
    const result = toCsv(["Full Name, Title"], [["Smith, John"]]);
    expect(result).toContain('"Full Name, Title"');
  });

  it("correct field count per row matches header length", () => {
    const result = toCsv(["A", "B", "C"], [["1", null, "3"]]);
    const [headerLine, dataLine] = result.split("\r\n");
    expect(headerLine?.split(",").length).toBe(3);
    expect(dataLine?.split(",").length).toBe(3);
  });
});
