"use client";

import { useTransition } from "react";
import { ConfirmButton } from "@/components/action-form";
import { ROLE_LABEL } from "@/lib/labels";
import type { Membership } from "@/lib/types";
import { removeMember, updateMemberRole } from "../admin-actions";

export function MemberControls({ id, role, name, team }: { id: string; role: Membership["role"]; name: string; team: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <select
        aria-label={`${name}의 역할`}
        defaultValue={role}
        disabled={pending}
        onChange={(e) => start(() => updateMemberRole(id, e.target.value as Membership["role"]))}
        className="rl-select h-8 rounded-[6px] border border-control bg-surface pl-2 text-[13px]"
      >
        {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ConfirmButton variant="ghost" label="빼기" confirmText={`${name}님을 ${team}에서 뺄까요? 이 팀 저장소의 리뷰를 더 볼 수 없게 됩니다.`} run={() => removeMember(id)} />
    </span>
  );
}
