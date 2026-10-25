import { createServer } from "node:http";
import { once } from "node:events";
import { expect, it } from "vitest";
import { fetchAiResponse, isPublicAiAddress } from "./ai-http";

it("rejects private, mapped, metadata and mixed-DNS destinations for personal connections", async () => {
  for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "169.254.169.254", "10.0.0.1", "fc00::1"]) expect(isPublicAiAddress(address)).toBe(false);
  expect(isPublicAiAddress("8.8.8.8")).toBe(true);
  await expect(fetchAiResponse("http://8.8.8.8/model", { headers: {}, body: "{}" }, true)).rejects.toMatchObject({ code: "AI_ENDPOINT_HTTPS_REQUIRED" });
  await expect(fetchAiResponse("http://127.0.0.1/model", { headers: {}, body: "{}" })).rejects.toMatchObject({ code: "AI_ENDPOINT_NOT_PUBLIC" });
  await expect(fetchAiResponse("https://model.example.test/model", { headers: {}, body: "{}" }, false, { resolve: async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }] })).rejects.toMatchObject({ code: "AI_ENDPOINT_NOT_PUBLIC" });
});

it("does not follow redirects even for an administrator-managed private endpoint", async () => {
  let forwarded = false;
  const server = createServer((request, response) => {
    if (request.url === "/target") forwarded = true;
    response.writeHead(302, { Location: "/target" }); response.end();
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const address = server.address(); if (!address || typeof address === "string") throw new Error("No port");
    const response = await fetchAiResponse(`http://127.0.0.1:${address.port}/start`, { headers: { Authorization: "Bearer synthetic" }, body: "{}" }, true);
    expect(response.status).toBe(302); expect(forwarded).toBe(false);
  } finally { server.close(); }
});

it.each([204, 205, 304, 600])("handles provider status %i without throwing from the socket callback", async (status) => {
  const server = createServer((_request, response) => { response.writeHead(status); response.end(); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const address = server.address(); if (!address || typeof address === "string") throw new Error("No port");
    const response = fetchAiResponse(`http://127.0.0.1:${address.port}/model`, { headers: {}, body: "{}" }, true);
    if (status === 600) await expect(response).rejects.toMatchObject({ code: "AI_RESPONSE_INVALID" });
    else { expect((await response).status).toBe(status); expect(await (await response).text()).toBe(""); }
  } finally { server.close(); }
});
