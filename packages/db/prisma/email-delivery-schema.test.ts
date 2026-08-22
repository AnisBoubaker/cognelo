import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202608220001_email_delivery_configuration/migration.sql", import.meta.url),
  "utf8"
);

describe("email delivery schema", () => {
  it("stores one global SMTP or Microsoft Graph configuration", () => {
    expect(schema).toContain("enum EmailDeliveryTransport");
    expect(schema).toContain("microsoft_graph");
    expect(schema).toContain("model EmailDeliveryConfiguration");
    expect(schema).toContain("smtpPasswordEncrypted");
    expect(schema).toContain("graphClientSecretEncrypted");
  });

  it("ships the platform migration", () => {
    expect(migration).toContain('CREATE TABLE "EmailDeliveryConfiguration"');
    expect(migration).toContain("CREATE TYPE \"EmailDeliveryTransport\" AS ENUM ('smtp', 'microsoft_graph')");
  });
});
