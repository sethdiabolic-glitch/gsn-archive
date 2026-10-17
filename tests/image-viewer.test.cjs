const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./helpers.cjs");
const images = load("src/lib/image-viewer.ts");
const { ImageViewerLink } = load("src/ImageViewerLink.tsx", {
  "react/jsx-runtime": require("react/jsx-runtime"),
  "./lib/image-viewer": images,
});
const { ImageViewer } = load("src/ImageViewer.tsx", {
  react: React,
  "react/jsx-runtime": require("react/jsx-runtime"),
  "lucide-react": require("lucide-react"),
  "./lib/image-viewer": images,
});
test("image URLs allow HTTP/HTTPS only, never scripts, data or embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/png,unsafe",
    "blob:https://example.com/id",
    "https://user:secret@example.com/a.png",
    "//example.com/a.png",
  ])
    assert.equal(images.safeImageSource(url), "");
  assert.equal(
    images.safeImageSource("https://example.com/image.png?x=1&y=2"),
    "https://example.com/image.png?x=1&y=2",
  );
});
test("return links cannot become external redirects or recursive viewer loops", () => {
  for (const back of ["//evil.example", "/\\evil.example", "https://evil.example", "/image?src=x"])
    assert.equal(images.safeImageBack(back), "/community");
  assert.equal(
    images.safeImageBack("/community?tag=Anis&match=any"),
    "/community?tag=Anis&match=any",
  );
});
test("viewer paths preserve source, title, credit, mature flag and filters; share links omit return context", () => {
  const path = images.imageViewPath("https://example.com/a.png", "Anis & summer", {
    credit: "Artist",
    mature: true,
    back: "/community?tag=Summer",
  });
  const params = Object.fromEntries(new URL("https://gsn.example" + path).searchParams);
  const view = images.imageSearch(params);
  assert.equal(view.src, "https://example.com/a.png");
  assert.equal(view.title, "Anis & summer");
  assert.equal(view.mature, true);
  assert.equal(view.credit, "Artist");
  const shared = new URL(images.imageShareUrl("https://gsn.example" + path));
  assert.equal(shared.searchParams.has("back"), false);
  assert.equal(shared.searchParams.get("mature"), "1");
  assert.equal(images.imageSearch({ mature: 1 }).mature, true);
  assert.equal(images.imageSearch({ mature: true }).mature, true);
});
test("download filenames are sanitized and use the real MIME extension", () => {
  const filename = images.imageDownloadName(
    "https://example.com/a.html",
    "../../Anis: summer?",
    "image/png",
  );
  assert.ok(filename.endsWith(".png"));
  assert.ok(!filename.includes("/"));
  assert.ok(!filename.includes(":"));
  assert.ok(!filename.startsWith("."));
  assert.equal(
    images.imageDownloadName("https://example.com/no-extension", "", "image/jpeg"),
    "archive-image.jpg",
  );
});
test("thumbnail renders a real image-page link and unsafe sources are not wrapped", () => {
  const safe = renderToStaticMarkup(
    React.createElement(
      ImageViewerLink,
      { src: "https://example.com/a.png", title: "Anis" },
      React.createElement("img", { src: "https://example.com/a.png", alt: "Anis" }),
    ),
  );
  assert.ok(safe.includes('href="/image?'));
  assert.ok(safe.includes("View image: Anis"));
  const unsafe = renderToStaticMarkup(
    React.createElement(
      ImageViewerLink,
      { src: "data:image/png,x", title: "Local" },
      "Local image",
    ),
  );
  assert.equal(unsafe, "Local image");
});
test("viewer actions appear below the image, and mature images require acknowledgement", () => {
  const image = images.imageSearch({
    src: "https://example.com/a.png",
    title: "Anis",
    credit: "Artist",
  });
  const html = renderToStaticMarkup(React.createElement(ImageViewer, { image }));
  assert.ok(html.indexOf("image-view-actions") > html.indexOf("<img"));
  for (const text of ["Download", "Share", "Copy link", "Open original", "By Artist"])
    assert.ok(html.includes(text));
  const mature = renderToStaticMarkup(
    React.createElement(ImageViewer, { image: { ...image, mature: true } }),
  );
  assert.ok(mature.includes("View mature image"));
  assert.ok(!mature.includes("<img"));
  const invalid = renderToStaticMarkup(
    React.createElement(ImageViewer, { image: { ...image, src: "" } }),
  );
  assert.ok(invalid.includes("missing or invalid"));
  assert.ok(!invalid.includes("<img"));
});
