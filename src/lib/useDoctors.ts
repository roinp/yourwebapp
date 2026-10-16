"use client";

import { useEffect, useState } from "react";
import { db } from "./localDb";
import type { Doctor } from "./types";

export function useDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  useEffect(() => {
    db
      .from("doctors")
      .select("*")
      .order("name")
      .then(({ data }) => setDoctors(data ?? []));
  }, []);
  return doctors;
}
