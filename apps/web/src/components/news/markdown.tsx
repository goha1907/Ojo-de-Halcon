import type { ComponentProps, ElementType } from "react";
import ReactMarkdown from "react-markdown";

/** react-markdown passes its AST `node` to every component; keep it out of the DOM. */
function styled<T extends ElementType>(Tag: T, className: string, extra?: ComponentProps<T>) {
  return function StyledElement({ node: _node, ...rest }: ComponentProps<T> & { node?: unknown }) {
    const Component = Tag as ElementType;
    return <Component className={className} {...extra} {...rest} />;
  };
}

const COMPONENTS = {
  h1: styled("h2", "mt-6 text-xl font-semibold text-slate-900"),
  h2: styled("h2", "mt-6 text-lg font-semibold text-slate-900"),
  h3: styled("h3", "mt-4 font-semibold text-slate-900"),
  p: styled("p", "mt-3 text-sm leading-6 text-slate-700"),
  ul: styled("ul", "mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700"),
  ol: styled("ol", "mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700"),
  a: styled("a", "text-brand-600 underline", { target: "_blank", rel: "noopener noreferrer" }),
  strong: styled("strong", "font-semibold text-slate-900"),
};

/** Renders trusted project Markdown (news) with the app's typography. Raw HTML is not rendered. */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>;
}
