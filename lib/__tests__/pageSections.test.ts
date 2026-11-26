import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  creatorEarnings,
  fetchPageSections,
  itemsOf,
  parseSettings,
  toSections
} from "../cms/pageSections";

import creatorsSeed from "../../data/cms/creators.json";

const respond = (body: unknown, ok = true, calls: string[] = []) => {
  return async (url: string) => {
    calls.push(url);
    return { ok, json: async () => body };
  };
};

const doc = (sections: unknown[]) => ({
  response_data: { homepage_sections: sections }
});

describe("parseSettings", () => {
  test("objects pass through, JSON and Ruby hash strings parse", () => {
    assert.deepEqual(parseSettings({ a: 1 }), { a: 1 });
    assert.deepEqual(parseSettings('{"a": 1}'), { a: 1 });
    assert.deepEqual(parseSettings('{"a"=>1, "b"=>nil}'), { a: 1, b: null });
  });

  test("anything else is empty", () => {
    for (const v of [null, undefined, "", "nope", "[1]", 3, [1]])
      assert.deepEqual(parseSettings(v), {});
  });
});

describe("itemsOf", () => {
  test("keeps items with every required key filled", () => {
    const items = itemsOf<{ question: string; answer: string }>(
      {
        items: [
          { question: "Q", answer: "A" },
          { question: "Q only" },
          { question: " ", answer: "A" },
          null,
          "x"
        ]
      },
      ["question", "answer"]
    );
    assert.deepEqual(items, [{ question: "Q", answer: "A" }]);
  });

  test("no items array is empty", () => {
    assert.deepEqual(itemsOf({}, ["title"]), []);
    assert.deepEqual(itemsOf(null, ["title"]), []);
  });
});

describe("fetchPageSections", () => {
  test("asks for the page's visible sections and returns them in order", async () => {
    const calls: string[] = [];
    const sections = await fetchPageSections("creators", {
      baseUrl: "http://spree",
      fetchImpl: respond(
        doc([
          {
            id: 2,
            page_key: "creators",
            section_type: "faq",
            position: 2,
            settings: '{"items": []}'
          },
          {
            id: 1,
            page_key: "creators",
            section_type: "hero",
            position: 1,
            title: "Hi",
            content: "  "
          }
        ]),
        true,
        calls
      )
    });
    assert.deepEqual(calls, [
      "http://spree/api/v1/homepage_sections?visible_only=true&page_key=creators"
    ]);
    assert.deepEqual(
      sections?.map((s) => [s.id, s.section_type, s.title, s.content]),
      [
        [1, "hero", "Hi", null],
        [2, "faq", null, null]
      ]
    );
    assert.deepEqual(sections?.[1].settings, { items: [] });
  });

  test("an admin without page_key (homepage rows) counts as no sections", async () => {
    const sections = await fetchPageSections("creators", {
      baseUrl: "",
      fetchImpl: respond(doc([{ id: 1, section_type: "hero", position: 1 }]))
    });
    assert.equal(sections, null);
  });

  test("errors, empty pages and hidden rows give null", async () => {
    const fail = async () => {
      throw new Error("down");
    };
    assert.equal(
      await fetchPageSections("creators", { baseUrl: "", fetchImpl: fail }),
      null
    );
    assert.equal(
      await fetchPageSections("creators", {
        baseUrl: "",
        fetchImpl: respond({}, false)
      }),
      null
    );
    assert.equal(
      await fetchPageSections("creators", {
        baseUrl: "",
        fetchImpl: respond(
          doc([
            {
              id: 1,
              page_key: "creators",
              section_type: "hero",
              is_visible: false
            }
          ])
        )
      }),
      null
    );
  });
});

describe("fallback content", () => {
  test("the committed creators copy normalizes into renderable sections", () => {
    const sections = toSections(creatorsSeed);
    assert.equal(sections.length, creatorsSeed.length);
    assert.equal(sections[0].section_type, "hero");
    const faq = sections.find((s) => s.section_type === "faq");
    assert.ok(itemsOf(faq?.settings, ["question", "answer"]).length > 0);
  });
});

describe("creatorEarnings", () => {
  test("is the share of the price, to the cent", () => {
    assert.equal(creatorEarnings(8, 70), 5.6);
    assert.equal(creatorEarnings(9.99, 70), 6.99);
    assert.equal(creatorEarnings(0.5, 70), 0.35);
    assert.equal(creatorEarnings(-1, 70), 0);
    assert.equal(creatorEarnings(10, 150), 10);
  });
});
