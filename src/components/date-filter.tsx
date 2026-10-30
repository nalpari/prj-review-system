"use client";

import { useState } from "react";
import { field } from "./ui";

// GET 필터 폼의 날짜 입력. 비었는지를 data 속성으로 알려 흐린 글자로 보이게 한다.
export function DateFilter({ name, defaultValue, label }: { name: string; defaultValue: string; label: string }) {
  const [empty, setEmpty] = useState(!defaultValue);
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      data-empty={empty}
      onChange={(e) => setEmpty(!e.target.value)}
      className={field}
    />
  );
}
