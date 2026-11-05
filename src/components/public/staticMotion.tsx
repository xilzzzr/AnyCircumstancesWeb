import { createElement, forwardRef, type HTMLAttributes } from "react";

// Prerendered public pages used framer-motion with `initial={{ opacity: 0 }}`, which ships
// invisible headings and text in the static HTML until JavaScript hydrates (and forever if
// it fails). This drop-in keeps the same JSX but renders plain, always-visible elements.
const MOTION_PROPS = new Set([
  "initial", "animate", "exit", "transition", "variants", "viewport",
  "whileInView", "whileHover", "whileTap", "whileFocus", "layout", "layoutId",
]);

type StaticMotionProps = HTMLAttributes<HTMLElement> & Record<string, unknown>;

function staticElement(tag: string) {
  const Component = forwardRef<HTMLElement, StaticMotionProps>((props, ref) => {
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(props)) if (!MOTION_PROPS.has(key)) clean[key] = props[key];
    return createElement(tag, { ...clean, ref });
  });
  Component.displayName = `static.${tag}`;
  return Component;
}

export const motion = {
  div: staticElement("div"),
  section: staticElement("section"),
  h1: staticElement("h1"),
  h2: staticElement("h2"),
  p: staticElement("p"),
  span: staticElement("span"),
  li: staticElement("li"),
};
