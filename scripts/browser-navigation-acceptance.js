async function navigationAcceptance(page) {
  const authenticated = await (await page.request.get('http://127.0.0.1:4200/api/auth/me')).json();
  if (!authenticated.authenticated) throw new Error('Sign in through real Life2 Auth in this browser session before running this owner acceptance check.');
  // Real API and database; cleanup deletes only sets created by this check.
  const base = "http://127.0.0.1:4200";
  const ids = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const check = (value, message) => {
    if (!value) throw new Error(message);
  };
  const mode = async (id, value) => {
    await page.waitForURL(`${base}/set/${id}/${value}`);
    await page
      .locator(".mode-switch .active")
      .filter({ hasText: value === "edit" ? "Edit Mode" : "Practice Mode" })
      .waitFor();
  };
  try {
    for (let i = 0; i < 2; i++) {
      const response = await page.request.post(`${base}/api/sets`, {
        headers: { Origin: base },
        data: {
          name: `Navigation acceptance ${Date.now()} ${i}`,
          description: "",
        },
      });
      check(response.status() === 201, "Create set failed");
      ids.push((await response.json()).id);
    }
    const card = await page.request.post(`${base}/api/sets/${ids[0]}/cards`, {
      headers: { Origin: base },
      data: {
        front_type: "text",
        front_content: "Navigation question",
        back_type: "text",
        back_content: "Navigation answer",
        front_instruction: "",
        back_explanation: "",
      },
    });
    check(card.status() === 201, "Create card failed");
    await page.goto(base);
    await page.evaluate(() =>
      localStorage.setItem("kids-flashcards-language", "en"),
    );
    await page.reload();
    await page
      .locator(".set-tile")
      .filter({
        hasText: (
          await (await page.request.get(`${base}/api/sets/${ids[0]}`)).json()
        ).name,
      })
      .click();
    await mode(ids[0], "practice");
    await page
      .getByRole("button", { name: "Flip flashcard", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Edit Mode", exact: true }).click();
    await mode(ids[0], "edit");
    await page.reload();
    await mode(ids[0], "edit");
    await page.locator(".flashcard-tile").waitFor();
    await page.goBack();
    await mode(ids[0], "practice");
    await page.goForward();
    await mode(ids[0], "edit");
    const second = (
      await (await page.request.get(`${base}/api/sets/${ids[1]}`)).json()
    ).name;
    await page
      .locator(".sidebar .set-link")
      .filter({ hasText: second })
      .click();
    await mode(ids[1], "practice");
    await page
      .getByRole("heading", { name: "Ready when your cards are" })
      .waitFor();
    await page.goBack();
    await mode(ids[0], "edit");
    await page.locator(".flashcard-tile").waitFor();
    await page.goForward();
    await mode(ids[1], "practice");
    await page
      .getByRole("button", { name: "My flashcard sets", exact: true })
      .click();
    await page.waitForURL(base + "/");
    await page.goBack();
    await mode(ids[1], "practice");
    await page.goto(`${base}/set/${ids[0]}/practice`);
    await mode(ids[0], "practice");
    await page
      .getByRole("button", { name: "Flip flashcard", exact: true })
      .waitFor();
    await page.reload();
    await mode(ids[0], "practice");
    await page
      .getByRole("button", { name: "Flip flashcard", exact: true })
      .waitFor();
    await page.goto(`${base}/set/${ids[0]}`);
    await mode(ids[0], "practice");
    await page.goto(
      `${base}/set/00000000-0000-0000-0000-000000000000/practice`,
    );
    await page.locator(".toast-error").waitFor();
    check(
      page.url().endsWith("/set/00000000-0000-0000-0000-000000000000/practice"),
      "Unavailable set URL must remain retryable",
    );
    await page.goto(`${base}/set/${ids[0]}/invalid`);
    await page.waitForURL(base + "/");
    await page.locator(".set-tile").first().waitFor();
    check(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
    await page.screenshot({
      path: "output/playwright/navigation-library.png",
      fullPage: true,
    });
    return {
      result: "PASS",
      checks:
        "default Practice, mode URL changes, Edit/Practice reload, direct links, bare-set redirect, Back/Forward across modes/sets/library, empty sets, missing sets, invalid mode paths",
      sets: ids.length,
    };
  } finally {
    for (const id of ids) await page.request.delete(`${base}/api/sets/${id}`, { headers: { Origin: base } });
  }
}
