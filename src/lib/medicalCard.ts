// Dental medical card — Georgian form IV-220 (stomat.docx): card + Annex 2 (exam sheet) + Annex 3 (consent).

export const CLINIC_NAME = "yourwebapp";

/** Brand name shown in the app header and on printouts. */
export const CLINIC_BRAND = "YOURWEBAPP";

export type DiaryRow = { date: string; text: string; doctor: string };

export type MedicalCardData = {
  provider: string;
  /** Identifies one examination; a new one starts a separate entry in the card history. */
  exam_key: string;
  // Card (personal data not stored on the patient record)
  sex: string;
  address: string;
  workplace: string;
  allergies: string;
  diseases: string;
  insurance_policy: string;
  insurance_company: string;
  // Annex 2 — examination sheet
  exam_date: string;
  complaints: string[];
  complaint_teeth: string;
  complaints_other: string;
  anamnesis: string;
  teeth: Record<string, string>;
  occlusion: string;
  mucosa: string;
  perio: string[];
  plaque: string[];
  pocket_depth: string;
  perio_other: string;
  plan: string[];
  plan_other: string;
  result: string;
  diagnosis: string;
  treatment: string;
  next_visit: string;
  diary: DiaryRow[];
  epicrisis: string;
  advice: string;
  // Annex 3 — informed consent
  consent_patient: string;
  consent_doctor: string;
  consent_date: string;
};

export function emptyCard(): MedicalCardData {
  return {
    provider: CLINIC_NAME,
    exam_key: "",
    sex: "",
    address: "",
    workplace: "",
    allergies: "",
    diseases: "",
    insurance_policy: "",
    insurance_company: "",
    exam_date: "",
    complaints: [],
    complaint_teeth: "",
    complaints_other: "",
    anamnesis: "",
    teeth: {},
    occlusion: "",
    mucosa: "",
    perio: [],
    plaque: [],
    pocket_depth: "",
    perio_other: "",
    plan: [],
    plan_other: "",
    result: "",
    diagnosis: "",
    treatment: "",
    next_visit: "",
    diary: [],
    epicrisis: "",
    advice: "",
    consent_patient: "",
    consent_doctor: "",
    consent_date: "",
  };
}

/** Saved JSON merged over defaults, so cards saved before a field existed still load. */
export function normalizeCard(data: Partial<MedicalCardData> | null | undefined): MedicalCardData {
  return { ...emptyCard(), ...(data ?? {}) };
}

export const SEX_OPTIONS = ["მამრობითი", "მდედრობითი"];

// Complaints — two columns, in the order of the paper form.
export const COMPLAINTS_LEFT = [
  "გამღიზიანებლით გამოწვეული მიზეზობრივი ხასიათის ტკივილი",
  "ტკივილი კბილის კბილზე დაჭერისას",
  "ყრუ ხასიათის ტკივილი",
  "თვითნებითი ხასიათის ტკივილი",
  "ღამის ტკივილი",
  "ესთეტიკური დისკომფორტი",
  "ბჟენის დეფექტი",
];
export const COMPLAINTS_RIGHT = [
  "გვირგვინის დეფექტი",
  "ფესვი",
  "სახის ასიმეტრია",
  "ქვისა და რბილი ნადების არსებობა",
  "სისხლდენა ღრძილებიდან",
  "ადენტია",
  "ჰალიტოზი",
  "საფეთქელ-ქვედა ყბის სახსრის პათოლოგია",
];

export const PERIO_OPTIONS = [
  "შეშუპება",
  "ჰიპერემია",
  "ციანოზი",
  "რეტრაქცია",
  "ჰიპერტროფია",
  "სისხლდენა",
  "ძვლოვანი ჯიბე",
  "ალვეოლური მორჩის ატროფია",
  "პაროდონტული ჯიბე",
];
export const PLAQUE_OPTIONS = ["არ აღინიშნება", "რბილი", "პიგმენტური", "მაგარი", "ღრძილზედა", "ღრძილქვეშა"];

export const PLAN_LEFT = [
  "ანამნეზის შეკრება",
  "სახისა და პირის ღრუს დათვალიერება",
  "თერმოდიაგნოსტიკა",
  "ვიზიორენტგენოგრაფიული გამოკვლევა",
  "რენტგენოლოგიური გამოკვლევა",
  "სპეციფიკური ალერგოდიაგნოსტიკა",
];
export const PLAN_RIGHT = ["ორთოპანტომოგრაფია", "ელექტროოდონტომეტრია", "აპექს-ლოკაცია", "კომპიუტერული ტომოგრაფია"];

// Tooth chart (FDI numbering) — the original form's chart image is not embedded in stomat.docx.
export const TEETH_UPPER = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
export const TEETH_LOWER = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];
export const PRIMARY_UPPER = ["55", "54", "53", "52", "51", "61", "62", "63", "64", "65"];
export const PRIMARY_LOWER = ["85", "84", "83", "82", "81", "71", "72", "73", "74", "75"];

export const TOOTH_CODES: { code: string; label: string }[] = [
  { code: "C", label: "კარიესი" },
  { code: "P", label: "პულპიტი" },
  { code: "Pt", label: "პერიოდონტიტი" },
  { code: "Pl", label: "ბჟენი" },
  { code: "R", label: "ფესვი" },
  { code: "O", label: "არ არის (ამოღებული)" },
  { code: "K", label: "გვირგვინი" },
  { code: "Ar", label: "ხელოვნური კბილი" },
  { code: "I", label: "იმპლანტი" },
  { code: "Pa", label: "პაროდონტიტი" },
  { code: "M", label: "მოძრაობა" },
];
