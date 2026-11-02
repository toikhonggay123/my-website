const sections = {
  overview: "overview",
  scanner: "scanner",
  attendance: "attendance",
  missing: "attendance",
  students: "students",
  qrcards: "students",
  reports: "reports",
  settings: "settings",
  guide: "guide",
};

export function sectionForView(view) {
  return Object.hasOwn(sections, view) ? sections[view] : "overview";
}

// Keep old bookmarked tabs working alongside the grouped navigation.
export function viewFromSearch(search) {
  const params = new URLSearchParams(search);
  const section = params.get("tab");
  const view = params.get("view");
  if (section === "attendance" && view === "missing") return "missing";
  if (section === "students" && view === "qrcards") return "qrcards";
  return section && Object.hasOwn(sections, section) ? section : "overview";
}

export function searchForView(view, search = "") {
  const params = new URLSearchParams(search);
  const section = sectionForView(view);
  params.set("tab", section);
  if (view !== section) params.set("view", view);
  else params.delete("view");
  return "?" + params.toString();
}
