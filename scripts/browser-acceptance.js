async function acceptance(page) {
  const authenticated = await (await page.request.get('http://127.0.0.1:4200/api/auth/me')).json();
  if (!authenticated.authenticated) throw new Error('Sign in through real Life2 Auth in this browser session before running this owner acceptance check.');
  // This acceptance check uses the real running API and local PostgreSQL.
  // Only the set created by this check is deleted in cleanup.
  const name = `Browser acceptance ${Date.now()}`;
  let setId;
  const uploads = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("NG0956"))
      errors.push(message.text());
  });
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const saved = async () => {
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  };
  const textCard = async (front, back, instruction, explanation) => {
    await page
      .getByRole("button", { name: "Add flashcard", exact: true })
      .click();
    await page.getByLabel("Front text", { exact: true }).fill(front);
    await page.getByLabel("Back text", { exact: true }).fill(back);
    await page.getByLabel("Instruction below card").fill(instruction);
    await page.getByLabel("Explanation below card").fill(explanation);
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    await saved();
  };
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("http://127.0.0.1:4200");
    await page.locator(".language-toggle").waitFor();
    const english = page.getByRole("button", { name: "Switch to English", exact: true });
    if (await english.count()) await english.click();
    await page
      .getByRole("button", { name: "Create a set", exact: true })
      .last()
      .click();
    check(
      await page
        .getByRole("button", { name: "Save set", exact: true })
        .isDisabled(),
      "Blank set must not save",
    );
    await page.getByLabel("Set name", { exact: true }).fill(name);
    await page
      .getByLabel("Description")
      .fill("Temporary real-browser verification");
    const createdPromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/sets") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save set", exact: true }).click();
    const created = await createdPromise;
    check(created.status() === 201, "Set creation failed");
    setId = (await created.json()).id;
    await saved();
    await page.getByText("Set saved", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Practice Mode", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Ready when your cards are" })
      .waitFor();
    await page.getByRole("button", { name: "Go to Edit Mode" }).click();
    await textCard("One", "Un", "Say the French word.", "Un means one.");
    await textCard("Two", "Deux", "Count to two.", "Deux means two.");
    check(
      (await page.locator(".flashcard-tile").count()) === 2,
      "Both cards must appear",
    );
    await page
      .getByRole("button", { name: "Edit card", exact: true })
      .first()
      .click();
    await page.getByLabel("Front text", { exact: true }).fill("One edited");
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    await saved();
    await page
      .locator(".tile-face")
      .first()
      .getByRole("heading", { name: "One edited" })
      .waitFor();
    await page
      .getByRole("button", { name: "Move card down", exact: true })
      .first()
      .click();
    await page
      .locator(".tile-face")
      .first()
      .getByRole("heading", { name: "Two", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Add flashcard", exact: true })
      .click();
    await page
      .getByLabel("Show on the front", { exact: true })
      .selectOption("image");
    // A real rejected upload must produce visible failure feedback.
    await page.getByLabel("Front picture", { exact: true }).setInputFiles({
      name: "invalid.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await page.locator(".toast-error").waitFor();
    check(
      await page
        .getByRole("button", { name: "Save card", exact: true })
        .isDisabled(),
      "Invalid picture must not enable save",
    );
    const uploadFrontPromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/uploads") && r.status() === 201,
    );
    await page
      .getByLabel("Front picture", { exact: true })
      .setInputFiles("scripts/fixtures/picture.png");
    uploads.push((await (await uploadFrontPromise).json()).url);
    await page.getByAltText("Front picture preview").waitFor();
    await page
      .getByLabel("Show on the back", { exact: true })
      .selectOption("image");
    const uploadBackPromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/uploads") && r.status() === 201,
    );
    await page
      .getByLabel("Back picture", { exact: true })
      .setInputFiles("scripts/fixtures/picture.png");
    uploads.push((await (await uploadBackPromise).json()).url);
    await page.getByAltText("Back picture preview").waitFor();
    await page
      .getByLabel("Instruction below card")
      .fill("Look at the picture.");
    await page
      .getByLabel("Explanation below card")
      .fill("This is a green circle.");
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    await saved();
    await page.getByRole("button", { name: "Edit set", exact: true }).click();
    await page.getByLabel("Set name", { exact: true }).fill(name + " edited");
    await page.getByRole("button", { name: "Save set", exact: true }).click();
    await saved();
    await page
      .getByRole("heading", { name: name + " edited", exact: true })
      .waitFor();
    await page.reload();
    await page.locator(".flashcard-tile").nth(2).waitFor();
    check(
      page.url().endsWith(`/set/${setId}/edit`),
      "Reload must restore the edit deep link",
    );
    await page
      .getByRole("button", { name: "My flashcard sets", exact: true })
      .click();
    await page
      .getByRole("button")
      .filter({
        has: page.getByRole("heading", { name: name + " edited", exact: true }),
      })
      .click();
    await page
      .getByRole("button", { name: "Flip flashcard", exact: true })
      .waitFor();
    check(
      (await page.locator(".mode-switch .active").textContent()).includes(
        "Practice Mode",
      ),
      "Opening a set after reload must default to Practice",
    );
    await page.getByRole("button", { name: "Edit Mode", exact: true }).click();
    await page
      .locator(".sidebar .set-link")
      .filter({ hasText: name + " edited" })
      .click();
    await page
      .getByRole("button", { name: "Flip flashcard", exact: true })
      .waitFor();
    check(
      (await page.locator(".mode-switch .active").textContent()).includes(
        "Practice Mode",
      ),
      "Opening from the sidebar after editing must default to Practice",
    );
    await page.getByRole("button", { name: "Edit Mode", exact: true }).click();
    await page
      .getByRole("button", { name: "My flashcard sets", exact: true })
      .click();
    await page
      .locator(".set-tile")
      .filter({ hasText: name + " edited" })
      .click();
    await page
      .getByRole("button", { name: "Flip flashcard", exact: true })
      .waitFor();
    check(
      (await page.locator(".mode-switch .active").textContent()).includes(
        "Practice Mode",
      ),
      "Reopening from the library after editing must default to Practice",
    );
    await page.getByRole("button", { name: "Edit Mode", exact: true }).click();
    await page.locator(".flashcard-tile").nth(2).waitFor();
    check(
      (await page.locator(".tile-face h3").first().textContent()).trim() ===
        "Two",
      "Reorder must persist after reload",
    );
    check(
      (await page.locator(".flashcard-tile").count()) === 3,
      "Cards must persist after reload",
    );
    await page.screenshot({
      path: "output/playwright/edit-mode.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Practice Mode", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Flip flashcard", exact: true })
      .waitFor();
    const fronts = [];
    for (let i = 0; i < 3; i++) {
      await page.getByText(`Card ${i + 1} of 3`, { exact: true }).waitFor();
      const card = page.getByRole("button", {
        name: "Flip flashcard",
        exact: true,
      });
      const front = (await card
        .locator(".practice-card-front .practice-text")
        .count())
        ? (
            await card
              .locator(".practice-card-front .practice-text")
              .textContent()
          ).trim()
        : await card.locator(".practice-card-front img").getAttribute("src");
      fronts.push(front);
      check(
        (await page
          .getByRole("button", { name: "Previous", exact: true })
          .isDisabled()) ===
          (i === 0),
        "Previous boundary incorrect",
      );
      // Real CSS transitions must run in both directions, with readable final faces.
      const height = await card.evaluate(
        (button) => button.getBoundingClientRect().height,
      );
      for (const back of [true, false, true]) {
        await card.click();
        const animation = await card.evaluate(async (button) => {
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          const inner = button.querySelector(".practice-card-inner");
          const animations = inner.getAnimations();
          const duration = getComputedStyle(inner).transitionDuration;
          const running = animations.some((a) => a.playState === "running");
          const halfway = animations[0];
          if (halfway) await new Promise((resolve) => setTimeout(resolve, 80));
          const matrix = new DOMMatrixReadOnly(
            getComputedStyle(inner).transform,
          );
          const intermediate = Math.abs(matrix.m13) > 0.01;
          await Promise.all(animations.map((a) => a.finished));
          return {
            running,
            duration,
            intermediate,
            end: new DOMMatrixReadOnly(getComputedStyle(inner).transform).m11,
            height: button.getBoundingClientRect().height,
          };
        });
        check(
          animation.running &&
            animation.duration === "0.4s" &&
            animation.intermediate,
          `Flip must animate through an intermediate 3D angle: ${JSON.stringify(animation)}`,
        );
        check(
          Math.abs(animation.end - (back ? -1 : 1)) < 0.001,
          "Flip must finish on the correct face",
        );
        check(
          Math.abs(animation.height - height) < 1,
          "Flipping must not resize the card",
        );
        check(
          (await card
            .locator(back ? ".practice-card-front" : ".practice-card-back")
            .getAttribute("aria-hidden")) === "true",
          "Inactive face must be hidden from assistive technology",
        );
        const accessible = await card.ariaSnapshot();
        check(
          accessible.includes(back ? "BACK" : "FRONT") &&
            !accessible.includes(back ? "FRONT" : "BACK"),
          "Only the active face should be exposed to assistive technology",
        );
      }
      if (front === "Two") {
        check(
          (await page.locator(".practice-note").textContent()).trim() ===
            "Deux means two.",
          "Back explanation missing",
        );
      }
      if (front === "One edited") {
        check(
          (await page.locator(".practice-note").textContent()).trim() ===
            "Un means one.",
          "Edited text card explanation missing",
        );
      }
      if (front?.startsWith("/uploads/")) {
        check(
          await card
            .locator(".practice-card-back img")
            .evaluate((img) => img.complete && img.naturalWidth > 0),
          "Back image failed to load",
        );
        check(
          (await page.locator(".practice-note").textContent()).trim() ===
            "This is a green circle.",
          "Image explanation missing",
        );
      }
      if (i < 2) {
        await page
          .getByRole("button", { name: "Next card", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            document
              .querySelector(".practice-card-front")
              ?.getAttribute("aria-hidden") === "false",
        );
        check(
          (await card
            .locator(".practice-card-front")
            .getAttribute("aria-hidden")) === "false",
          "Navigation must show the front",
        );
        check(
          await card
            .locator(".practice-card-inner")
            .evaluate(
              (inner) =>
                inner.getAnimations().length === 0 &&
                new DOMMatrixReadOnly(getComputedStyle(inner).transform).m11 ===
                  1,
            ),
          "Navigation must start on the front without animating the new answer",
        );
      }
    }
    check(
      new Set(fronts).size === 3,
      "Shuffled round must visit each card once",
    );
    check(
      await page
        .getByRole("button", { name: "Next card", exact: true })
        .isDisabled(),
      "Next boundary incorrect",
    );
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await page.getByText("Card 2 of 3", { exact: true }).waitFor();
    const previous = (await page
      .locator(".practice-card-front .practice-text")
      .count())
      ? (
          await page
            .locator(".practice-card-front .practice-text")
            .textContent()
        ).trim()
      : await page.locator(".practice-card-front img").getAttribute("src");
    check(previous === fronts[1], "Previous must return to same card");
    await page.getByRole("button", { name: "Flip flashcard" }).focus();
    await page.keyboard.press("ArrowLeft");
    await page.getByText("Card 1 of 3", { exact: true }).waitFor();
    const first = (await page
      .locator(".practice-card-front .practice-text")
      .count())
      ? (
          await page
            .locator(".practice-card-front .practice-text")
            .textContent()
        ).trim()
      : await page.locator(".practice-card-front img").getAttribute("src");
    check(first === fronts[0], "Keyboard navigation failed");
    const flipButton = page.getByRole("button", {
      name: "Flip flashcard",
      exact: true,
    });
    await flipButton.focus();
    await page.keyboard.press("Space");
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    check(
      await flipButton
        .locator(".practice-card-inner")
        .evaluate((inner) => inner.classList.contains("is-flipped")),
      "Space must flip exactly once",
    );
    await page.keyboard.press("Space");
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    check(
      await flipButton
        .locator(".practice-card-inner")
        .evaluate((inner) => !inner.classList.contains("is-flipped")),
      "Space must flip back",
    );
    // Rapid clicks during a transition must settle on the latest requested face.
    await flipButton.evaluate(async (button) => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 60));
      button.click();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      await Promise.all(
        button
          .querySelector(".practice-card-inner")
          .getAnimations()
          .map((a) => a.finished),
      );
    });
    check(
      await flipButton
        .locator(".practice-card-inner")
        .evaluate(
          (inner) =>
            !inner.classList.contains("is-flipped") &&
            new DOMMatrixReadOnly(getComputedStyle(inner).transform).m11 === 1,
        ),
      "Rapid flipping must settle on the front",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const back of [true, false]) {
      await flipButton.click();
      await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      check(
        await flipButton
          .locator(".practice-card-inner")
          .evaluate(
            (inner, back) =>
              getComputedStyle(inner).transitionDuration === "0s" &&
              inner.getAnimations().length === 0 &&
              Math.abs(
                new DOMMatrixReadOnly(getComputedStyle(inner).transform).m11 -
                  (back ? -1 : 1),
              ) < 0.001,
            back,
          ),
        "Reduced motion must switch instantly in both directions",
      );
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Shuffle again" }).click();
    await page.screenshot({
      path: "output/playwright/practice-mode.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Mobile horizontal overflow",
    );
    await page.screenshot({
      path: "output/playwright/mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1200, height: 1000 });
    await page.getByRole("button", { name: "Edit Mode", exact: true }).click();
    await page
      .getByRole("button", { name: "Delete card", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Keep it", exact: true }).click();
    check(
      (await page.locator(".flashcard-tile").count()) === 3,
      "Cancel delete must preserve cards",
    );
    await page
      .getByRole("button", { name: "Delete card", exact: true })
      .first()
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete card", exact: true })
      .click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    check(
      (await page.locator(".flashcard-tile").count()) === 2,
      "Delete card failed",
    );
    await page.getByRole("button", { name: "Delete set", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete set", exact: true })
      .click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    const deleted = await page.request.get(
      `http://127.0.0.1:4200/api/sets/${setId}`,
    );
    check(deleted.status() === 404, "Deleted set persisted");
    check(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
    return {
      result: "PASS",
      checks:
        "set/card CRUD, reorder persistence, both picture faces, real validation error toast, shuffled practice, bidirectional 3D animation for text/images, rapid flipping, reduced motion, accessible faces, captions, previous/next reset, Space keyboard, mobile layout, deletion",
      uploads,
    };
  } finally {
    if (setId)
      await page.request.delete(`http://127.0.0.1:4200/api/sets/${setId}`, { headers: { Origin: "http://127.0.0.1:4200" } });
  }
}
