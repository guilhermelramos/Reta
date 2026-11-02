import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { getPageFocus, setPageFocus, subscribePageFocus } from "./page-focus.ts";

describe("page-focus: pedido de layout imersivo", () => {
  beforeEach(() => {
    setPageFocus(false);
  });

  it("começa desligado e liga ao ser pedido", () => {
    assert.equal(getPageFocus(), false);
    setPageFocus(true);
    assert.equal(getPageFocus(), true);
  });

  it("avisa os inscritos em cada mudança e para depois do unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribePageFocus(() => {
      calls += 1;
    });

    setPageFocus(true);
    assert.equal(calls, 1);
    setPageFocus(true);
    assert.equal(calls, 1);

    setPageFocus(false);
    assert.equal(calls, 2);

    unsubscribe();
    setPageFocus(true);
    assert.equal(calls, 2);
  });
});
