/* P0 Recovery: Full Workflow Seeds */
(function () {
  if (window.__SEEDS_V2__) return; window.__SEEDS_V2__ = true;

  const DATA = {
    partners: [
      { id: "p1", name: "Acme Co", email: "acme@ex.com", phone: "5551112222", city: "Austin", tier: "Preferred" },
      { id: "p2", name: "Zen Realty", email: "zen@re.com", phone: "5553334444", city: "Dallas", tier: "Strategic" },
      { id: "p3", name: "North Title", email: "title@north.com", phone: "5552223333", city: "Houston", tier: "Developing" }
    ],
    contacts: [
      { id: "c1", firstName: "Alex", lastName: "Morris", email: "alex@home.com", buyerPartnerId: "p1", listingPartnerId: "p2", loanType: "Conventional", stage: "Long Shot", status: "nurture", pipelineMilestone: "Intro Call" },
      { id: "c2", firstName: "Bailey", lastName: "Stone", email: "bailey@work.com", buyerPartnerId: "p2", listingPartnerId: "p1", loanType: "FHA", stage: "Application", status: "inprogress", pipelineMilestone: "Application Submitted" },
      { id: "c3", firstName: "Cam", lastName: "Rivera", email: "cam@rivera.com", buyerPartnerId: "p2", listingPartnerId: "p3", loanType: "VA", stage: "Processing", status: "active", pipelineMilestone: "UW in Progress", birthday: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0] },
      { id: "c4", firstName: "Devon", lastName: "King", email: "devon@loan.com", buyerPartnerId: "p1", listingPartnerId: "p3", loanType: "Jumbo", stage: "Underwriting", status: "paused", pipelineMilestone: "Conditions Out" },
      { id: "c5", firstName: "Eli", lastName: "Thompson", email: "eli@closed.com", buyerPartnerId: "p3", listingPartnerId: "p1", loanType: "Conventional", stage: "Funded", status: "client", pipelineMilestone: "Funded / Post-Close", fundedDate: Date.now() - 86400000, anniversary: new Date(new Date().getFullYear(), new Date().getMonth(), 20).toISOString().split('T')[0] },
      { id: "c6", firstName: "Frank", lastName: "Lin", email: "frank@lost.com", buyerPartnerId: "p3", listingPartnerId: "p2", loanType: "USDA", stage: "Lost", status: "lost", pipelineMilestone: "Application Sent" }
    ],
    tasks: [
      { id: "t1", title: "Urgent Follow up", status: "open", due: new Date().toISOString().split('T')[0], contactId: "c1", linkedType: "contact", linkedId: "c1", type: "call", note: "Call Alex about rates" },
      { id: "t2", title: "Email Intro", status: "open", due: new Date(Date.now() + 86400000).toISOString().split('T')[0], contactId: "c2", linkedType: "contact", linkedId: "c2", type: "email", note: "Intro email to Bailey" },
      { id: "t3", title: "Partner Lunch", status: "open", due: new Date(Date.now() + 172800000).toISOString().split('T')[0], partnerId: "p1", linkedType: "partner", linkedId: "p1", type: "meeting", note: "Lunch with Acme" },
      { id: "t4", title: "Nurture Touch", status: "open", due: new Date().toISOString().split('T')[0], contactId: "c1", linkedType: "contact", linkedId: "c1", type: "nurture", note: "Weekly check-in" }
    ]
  };

  async function upsert(store, row) {
    try {
      const key = row.id;
      // Ensure DB scope
      const db = window.db || window.__APP_DB__;
      if (!db) throw new Error("DB not ready");

      const existing = await db.get(store, key).catch(() => null);
      const rec = existing ? { ...existing, ...row } : { ...row };
      await db.put(store, rec);
    } catch (e) {
      console.warn(`Seed failed for ${store}:`, e);
      // localStorage fallback
      const k = `seed:${store}`;
      const all = JSON.parse(localStorage.getItem(k) || "{}");
      all[row.id] = { ...(all[row.id] || {}), ...row };
      localStorage.setItem(k, JSON.stringify(all));
    }
  }

  async function runSeeds() {
    console.log("Running Full Workflow Seeds...");

    // Ensure DB is open if possible
    if (window.openDB) await window.openDB();

    for (const p of DATA.partners) await upsert("partners", p);
    for (const c of DATA.contacts) await upsert("contacts", c);
    for (const t of DATA.tasks) await upsert("tasks", t);

    // Force refresh
    window.dispatchAppDataChanged?.("seeds:complete");
    if (window.app && window.app.refresh) window.app.refresh();

    console.log("Full Workflow Seeds Complete");
  }

  window.Seeds = { runSeeds };
})();
