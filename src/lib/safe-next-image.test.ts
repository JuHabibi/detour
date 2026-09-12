import { describe, expect, it } from "vitest";
import { toSafeNextImageSrc } from "@/lib/safe-next-image";

describe("toSafeNextImageSrc", () => {
  it("autorise les hosts next/image configurés", () => {
    expect(
      toSafeNextImageSrc(
        "https://upload.wikimedia.org/wikipedia/commons/a.jpg",
      ),
    ).toContain("upload.wikimedia.org");
    expect(
      toSafeNextImageSrc("https://img.openagenda.com/u/x.jpg"),
    ).toContain("img.openagenda.com");
  });

  it("autorise les chemins locaux", () => {
    expect(toSafeNextImageSrc("/images/fallbacks/culture.svg")).toBe(
      "/images/fallbacks/culture.svg",
    );
  });

  it("rejette billetweb / univ-orleans", () => {
    expect(
      toSafeNextImageSrc(
        "https://www.billetweb.fr/files/event/150/1437112.jpg",
      ),
    ).toBeNull();
    expect(
      toSafeNextImageSrc(
        "https://www.univ-orleans.fr/upload/public/x.png",
      ),
    ).toBeNull();
  });
});
