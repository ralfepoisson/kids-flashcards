async function acceptance(page) {
  const authenticated = await (await page.request.get('http://127.0.0.1:4200/api/auth/me')).json();
  if (!authenticated.authenticated) throw new Error('Sign in through real Life2 Auth in this browser session before running this owner acceptance check.');
  // Real served UI, API, PostgreSQL, and picture upload; no runtime mocks.
  const base = "http://127.0.0.1:4200";
  const storageKey = "kids-flashcards-language";
  const name = `Language acceptance ${Date.now()}`;
  const description = "User content stays English / français: école, 7 × 8.";
  const errors = [];
  const uploads = [];
  let setId;
  let originalLanguage;
  let capturedPreference = false;
  const originalViewport = page.viewportSize();
  const onError = (error) => errors.push(error.message);
  page.on("pageerror", onError);
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const button = (label) => page.getByRole("button", { name: label, exact: true });
  const closed = () => page.getByRole("dialog").waitFor({ state: "hidden" });
  const detail = async () => {
    const response = await page.request.get(`${base}/api/sets/${setId}`);
    check(response.ok(), "API detail readback failed");
    return response.json();
  };
  const flag = async (language) => {
    const target = language === "en" ? "Passer en français" : "Switch to English";
    const toggle = button(target);
    await toggle.waitFor();
    check((await toggle.textContent()).trim() === (language === "en" ? "🇫🇷" : "🇬🇧"),
      "Flag must show the target language");
    check(await page.locator("html").getAttribute("lang") === language,
      "Document language must match interface language");
    const placement = await toggle.evaluate((element) => {
      const badge = document.querySelector(".local-badge");
      const header = document.querySelector(".topbar");
      const a = element.getBoundingClientRect();
      const b = badge.getBoundingClientRect();
      const h = header.getBoundingClientRect();
      return {
        before: !!(element.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING),
        left: a.right <= b.left + 1,
        sameLine: Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)) < 2,
        right: b.right > h.left + h.width / 2,
        visible: a.width > 0 && a.height > 0 && a.left >= 0 && a.right <= innerWidth,
      };
    });
    check(placement.before && placement.left && placement.sameLine && placement.right && placement.visible,
      `Flag must be visible before Kids Flashcards at the top right: ${JSON.stringify(placement)}`);
    check((await page.locator(".local-badge").textContent()).trim() === "Kids Flashcards",
      "Product name should remain Kids Flashcards");
    return toggle;
  };
  const switchTo = async (language, keyboard = false) => {
    const current = await page.locator("html").getAttribute("lang");
    const toggle = await flag(current);
    if (keyboard) {
      await toggle.focus();
      await page.keyboard.press("Space");
    } else {
      await toggle.click();
    }
    await page.waitForFunction((expected) => document.documentElement.lang === expected, language);
    await flag(language);
    check(await page.evaluate((key) => localStorage.getItem(key), storageKey) === language,
      "Language preference must persist to browser storage");
  };
  const practiceState = () => page.locator(".practice-space").evaluate((space) => {
    const face = (selector) => {
      const element = space.querySelector(selector);
      return element.querySelector("img")?.getAttribute("src")
        ?? element.querySelector(".practice-text")?.textContent.trim();
    };
    return {
      front: face(".practice-card-front"),
      back: face(".practice-card-back"),
      note: space.querySelector(".practice-note").textContent.trim(),
      index: space.querySelector(".progress").getAttribute("aria-valuenow"),
      flipped: space.querySelector(".practice-card-inner").classList.contains("is-flipped"),
    };
  });
  const equal = (before, after, message) => check(JSON.stringify(before) === JSON.stringify(after), message);
  const frenchTextCard = async (front, back, instruction, explanation) => {
    await button("Ajouter une carte").click();
    await page.getByRole("heading", { name: "Créer une carte", exact: true }).waitFor();
    await page.getByLabel("Texte du recto", { exact: true }).fill(front);
    await page.getByLabel("Texte du verso", { exact: true }).fill(back);
    await page.getByLabel("Consigne sous la carte").fill(instruction);
    await page.getByLabel("Explication sous la carte").fill(explanation);
    await button("Enregistrer la carte").click();
    await closed();
    await page.locator(".toast-success").filter({ hasText: "Carte enregistrée" }).last().waitFor();
  };
  try {
    await page.goto(base);
    await page.locator(".language-toggle").waitFor();
    originalLanguage = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    capturedPreference = true;
    await page.evaluate((key) => localStorage.removeItem(key), storageKey);
    await page.goto(base);
    await page.getByLabel("Rechercher des séries", { exact: true }).waitFor();
    await flag("fr");
    // Set a genuine browser preference to make the check independent of prior sessions.
    await page.evaluate((key) => localStorage.setItem(key, "en"), storageKey);
    await page.reload();
    await page.getByLabel("Search sets", { exact: true }).waitFor();
    await flag("en");
    await page.screenshot({ path: "output/playwright/language-english-library.png", fullPage: true });
    await button("Create a set").last().click();
    await page.getByRole("heading", { name: "Create flashcard set", exact: true }).waitFor();
    check(await page.getByLabel("Set name", { exact: true }).isVisible(), "English set editor label missing");
    check(await button("Save set").isDisabled(), "Blank English set must not save");
    await button("Cancel").click();
    await closed();
    await switchTo("fr", true);
    await page.getByLabel("Rechercher des séries", { exact: true }).waitFor();
    check(await button("Mes séries de cartes").count() >= 1, "French library navigation missing");
    await page.screenshot({ path: "output/playwright/language-french-library.png", fullPage: true });
    await button("Créer une série").last().click();
    await page.getByRole("heading", { name: "Créer une série de cartes", exact: true }).waitFor();
    check(await button("Enregistrer la série").isDisabled(), "Blank French set must not save");
    await page.getByLabel("Nom de la série", { exact: true }).fill(name);
    await page.getByLabel("Description").fill(description);
    const createdPromise = page.waitForResponse((r) => r.url().endsWith("/api/sets") && r.request().method() === "POST");
    await button("Enregistrer la série").click();
    const created = await createdPromise;
    check(created.status() === 201, "French set creation failed");
    setId = (await created.json()).id;
    await closed();
    await page.locator(".toast-success").filter({ hasText: "Série enregistrée" }).last().waitFor();
    await frenchTextCard("One remains English", "Un reste français", "Say the word aloud.", "Explication personnelle inchangée.");
    await frenchTextCard("7 × 8 = ?", "56", "Calculate in your own language.", "Sept groupes de huit.");
    await button("Ajouter une carte").click();
    await page.getByLabel("Afficher au recto", { exact: true }).selectOption("image");
    const rejectedPromise = page.waitForResponse((r) => r.url().endsWith("/api/uploads") && r.request().method() === "POST");
    await page.getByLabel("Image du recto", { exact: true }).setInputFiles({
      name: "invalid-language-picture.png", mimeType: "image/png", buffer: Buffer.from("not an image"),
    });
    check((await rejectedPromise).status() === 422, "Invalid upload must be rejected by the real API");
    await page.locator(".toast-error").filter({ hasText: "Le fichier envoyé n’est pas une image valide" }).waitFor();
    check(await page.locator(".toast-error").filter({ hasText: "Une erreur est survenue" }).isVisible(),
      "French error title missing");
    check(await button("Enregistrer la carte").isDisabled(), "Rejected picture must not enable saving");
    const uploadedPromise = page.waitForResponse((r) => r.url().endsWith("/api/uploads") && r.status() === 201);
    await page.getByLabel("Image du recto", { exact: true }).setInputFiles("scripts/fixtures/picture.png");
    uploads.push((await (await uploadedPromise).json()).url);
    await page.getByAltText("Aperçu de l’image du recto", { exact: true }).waitFor();
    await page.getByLabel("Texte du verso", { exact: true }).fill("A green circle / un cercle vert");
    await page.getByLabel("Consigne sous la carte").fill("Describe this picture.");
    await page.getByLabel("Explication sous la carte").fill("The picture is unchanged / image inchangée.");
    await button("Enregistrer la carte").click();
    await closed();
    await page.locator(".flashcard-tile").nth(2).waitFor();
    const savedData = await detail();
    check(savedData.name === name && savedData.description === description && savedData.cards.length === 3,
      "French UI must save the original user content");
    check(savedData.cards[0].front_content === "One remains English" &&
      savedData.cards[0].front_instruction === "Say the word aloud." &&
      savedData.cards[0].back_explanation === "Explication personnelle inchangée." &&
      savedData.cards[2].front_content === uploads[0], "API must preserve text, captions and picture URL");
    await switchTo("en");
    await button("Edit card").first().click();
    await page.getByRole("heading", { name: "Edit flashcard", exact: true }).waitFor();
    check(await page.getByLabel("Front text", { exact: true }).inputValue() === "One remains English",
      "English editor must preserve French-created card content");
    check(await page.getByLabel("Back text", { exact: true }).inputValue() === "Un reste français",
      "Card contents must not be translated");
    await page.getByLabel("Instruction below card").waitFor();
    await page.getByLabel("Explanation below card").waitFor();
    await button("Cancel").click();
    await closed();
    equal(savedData, await detail(), "Switching to English must not mutate stored content");
    await button("Practice Mode").click();
    await button("Flip flashcard").waitFor();
    await page.getByRole("progressbar", { name: "Practice progress", exact: true }).waitFor();
    const order = [];
    for (let i = 0; i < 3; i++) {
      await page.getByText(`Card ${i + 1} of 3`, { exact: true }).waitFor();
      order.push((await practiceState()).front);
      if (i < 2) await button("Next card").click();
    }
    check(new Set(order).size === 3, "Practice must include each real card once");
    await button("Previous").click();
    await page.getByText("Card 2 of 3", { exact: true }).waitFor();
    await button("Flip flashcard").click();
    await page.waitForFunction(() => document.querySelector('.practice-card-inner')?.classList.contains('is-flipped'));
    const beforeSwitch = await practiceState();
    check(beforeSwitch.flipped && beforeSwitch.index === "2", "Practice setup must be on the second card back");
    await page.screenshot({ path: "output/playwright/language-english-practice.png", fullPage: true });
    await switchTo("fr");
    await page.getByText("Carte 2 sur 3", { exact: true }).waitFor();
    await button("Retourner la carte").waitFor();
    await page.getByRole("progressbar", { name: "Progression de l’entraînement", exact: true }).waitFor();
    equal(beforeSwitch, await practiceState(), "Language switch must preserve selected card, index, flip and caption");
    equal(savedData, await detail(), "French switch must preserve all API set/card fields");
    await page.screenshot({ path: "output/playwright/language-french-practice.png", fullPage: true });
    await button("Carte suivante").click();
    await page.getByText("Carte 3 sur 3", { exact: true }).waitFor();
    check((await practiceState()).front === order[2], "French Next must preserve shuffled order");
    await button("Précédente").click();
    await page.getByText("Carte 2 sur 3", { exact: true }).waitFor();
    check((await practiceState()).front === order[1], "French Previous must preserve shuffled order");
    await button("Précédente").click();
    await page.getByText("Carte 1 sur 3", { exact: true }).waitFor();
    check((await practiceState()).front === order[0], "French practice must preserve the whole shuffled sequence");
    const beforeKeyboard = await practiceState();
    await switchTo("en", true);
    equal(beforeKeyboard, await practiceState(), "Space on the flag must switch language without flipping the card");
    await switchTo("fr");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await flag("fr");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `French interface must not overflow at ${width}px`);
      await page.screenshot({ path: `output/playwright/language-french-mobile-${width}.png`, fullPage: true });
      await switchTo("en");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `English interface must not overflow at ${width}px`);
      await flag("en");
      await switchTo("fr");
    }
    await page.setViewportSize({ width: 1200, height: 1000 });
    await page.reload();
    await flag("fr");
    check(await page.locator("html").getAttribute("lang") === "fr", "Reload must restore French preference");
    await button("Retourner la carte").waitFor();
    equal(savedData, await detail(), "Reload and practice must preserve API content");
    await button("Mode édition").click();
    await button("Modifier la série").click();
    await page.getByRole("heading", { name: "Modifier la série de cartes", exact: true }).waitFor();
    check(await page.getByLabel("Nom de la série", { exact: true }).inputValue() === name,
      "French set editor must preserve original set name");
    await page.getByLabel("Description").fill(description + " Verified");
    await button("Enregistrer la série").click();
    await closed();
    await page.locator(".toast-success").filter({ hasText: "Série enregistrée" }).last().waitFor();
    check((await detail()).description === description + " Verified", "French set edit must persist");
    await button("Supprimer la carte").first().click();
    await page.getByRole("heading", { name: "Supprimer cette carte ?", exact: true }).waitFor();
    await button("Conserver").click();
    check((await detail()).cards.length === 3, "French cancel delete must preserve cards");
    await button("Supprimer la carte").first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer la carte", exact: true }).click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    await page.locator(".toast-success").filter({ hasText: "Carte supprimée." }).waitFor();
    check((await detail()).cards.length === 2, "French card deletion must persist");
    await button("Supprimer la série").click();
    await page.getByRole("heading", { name: "Supprimer cette série ?", exact: true }).waitFor();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer la série", exact: true }).click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    await page.locator(".toast-success").filter({ hasText: "Série et cartes supprimées." }).waitFor();
    check((await page.request.get(`${base}/api/sets/${setId}`)).status() === 404,
      "French set deletion must persist");
    check(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
    return {
      result: "PASS",
      checks: "EN/FR header flags, translated library/editors/practice/dialogs/toasts, real CRUD and rejected/successful upload, unchanged API text/captions/images, selected practice card/index/flip/shuffle preservation, keyboard flag activation, reload preference, 390px/320px layouts",
      uploads,
    };
  } finally {
    page.off("pageerror", onError);
    if (setId) await page.request.delete(`${base}/api/sets/${setId}`, { headers: { Origin: base } });
    if (capturedPreference) {
      await page.evaluate(({ key, value }) => {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }, { key: storageKey, value: originalLanguage });
      await page.goto(base);
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
  }
}
