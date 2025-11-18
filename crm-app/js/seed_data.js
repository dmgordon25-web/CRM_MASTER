/* P6f: Idempotent seeds */
(function(){
  if (window.__SEEDS_V1__) return; window.__SEEDS_V1__ = true;

  async function upsert(store, key, row){
    try {
      const existing = await window.db.get(store, key).catch(()=>null);
      const rec = existing ? { ...existing, ...row, id: key } : { id: key, ...row };
      await window.db.put(store, rec);
    } catch (e) {
      // localStorage fallback
      const k = `seed:${store}`;
      const all = JSON.parse(localStorage.getItem(k)||"{}");
      all[key] = { ...(all[key]||{}), ...row, id:key };
      localStorage.setItem(k, JSON.stringify(all));
    }
  }

  async function runSeeds(){
    // Deterministic keys
    const p1="partner_acme_co", p2="partner_zen_realty", p3="partner_north_title";
    const c1="contact_alex_m",  c2="contact_bailey_s", c3="contact_cam_r", c4="contact_devon_k", c5="contact_eli_t", c6="contact_frank_l";

    await upsert("partners", p1, { name:"Acme Co", email:"acme@ex.com", phone:"5551112222", city:"Austin", tier:"Preferred" });
    await upsert("partners", p2, { name:"Zen Realty", email:"zen@re.com", phone:"5553334444", city:"Dallas", tier:"Strategic" });
    await upsert("partners", p3, { name:"North Title", email:"title@north.com", phone:"5552223333", city:"Houston", tier:"Developing" });

    await upsert("contacts", c1, { firstName:"Alex", lastName:"Morris", email:"alex@home.com", buyerPartnerId:p1, listingPartnerId:p2, loanType:"Conventional", stage:"Long Shot", status:"nurture", pipelineMilestone:"Intro Call" });
    await upsert("contacts", c2, { firstName:"Bailey", lastName:"Stone", email:"bailey@work.com", buyerPartnerId:p2, listingPartnerId:p1, loanType:"FHA", stage:"Application", status:"inprogress", pipelineMilestone:"Application Submitted" });
    await upsert("contacts", c3, { firstName:"Cam", lastName:"Rivera", email:"cam@rivera.com", buyerPartnerId:p2, listingPartnerId:p3, loanType:"VA", stage:"Processing", status:"active", pipelineMilestone:"UW in Progress" });
    await upsert("contacts", c4, { firstName:"Devon", lastName:"King", email:"devon@loan.com", buyerPartnerId:p1, listingPartnerId:p3, loanType:"Jumbo", stage:"Underwriting", status:"paused", pipelineMilestone:"Conditions Out" });
    await upsert("contacts", c5, { firstName:"Eli", lastName:"Thompson", email:"eli@closed.com", buyerPartnerId:p3, listingPartnerId:p1, loanType:"Conventional", stage:"Funded", status:"client", pipelineMilestone:"Funded / Post-Close", fundedDate: Date.now() - 86400000 });
    await upsert("contacts", c6, { firstName:"Frank", lastName:"Lin", email:"frank@lost.com", buyerPartnerId:p3, listingPartnerId:p2, loanType:"USDA", stage:"Lost", status:"lost", pipelineMilestone:"Application Sent" });

    window.dispatchAppDataChanged?.("seeds:complete");
  }

  window.Seeds = { runSeeds };
})();
