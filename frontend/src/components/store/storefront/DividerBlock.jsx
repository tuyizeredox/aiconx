import React from "react";

const HEIGHT_CLASSES = {
  sm: "h-4",
  md: "h-10",
  lg: "h-20",
};

export default function DividerBlock({ block }) {
  const data = block?.data || {};
  const { height = "md" } = data;
  return <div className={HEIGHT_CLASSES[height] || HEIGHT_CLASSES.md} />;
}
