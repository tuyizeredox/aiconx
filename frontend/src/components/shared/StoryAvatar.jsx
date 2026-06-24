import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";

export default function StoryAvatar({ user, size = "md" }) {
  const sizes = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };
  const innerSizes = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-18 h-18",
  };

  return (
    <Link
      to={createPageUrl("Profile") + `?email=${user.email}`}
      className="flex flex-col items-center gap-1.5 shrink-0"
    >
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px]`}>
        <div className={`${innerSizes[size]} rounded-full bg-white p-[2px]`}>
          <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              user.name?.[0]?.toUpperCase() || "U"
            )}
          </div>
        </div>
      </div>
      <span className="text-[11px] font-medium text-slate-600 truncate max-w-[64px]">{user.name?.split(" ")[0]}</span>
    </Link>
  );
}