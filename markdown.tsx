import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// if you want to allow inline HTML (the <span>), add:
import rehypeRaw from "rehype-raw";

const searchSpanClass = "cite";

function OutputSectionMarkdown({
  sectionContent,
  handleCiteClick,
}: {
  sectionContent: OutputSection;
  handleCiteClick: (guid: string) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]} // <- so ReactMarkdown parses inline HTML spans
      components={{
        h1: ({ ...props }) => (
          <h1 className="text-2xl font-bold text-blue-700 border-b pb-1 mb-4 mt-6" {...props} />
        ),
        p: ({ ...props }) => (
          <p className="text-gray-700 leading-relaxed mb-3" {...props} />
        ),
        ul: ({ ...props }) => (
          <ul className="list-disc list-inside mb-4 text-gray-700" {...props} />
        ),
        li: ({ ...props }) => <li className="ml-4 mb-1" {...props} />,
        hr: () => <hr className="my-8 border-gray-300" />,
        table: ({ ...props }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border border-gray-300 rounded-md" {...props} />
          </div>
        ),
        th: ({ ...props }) => (
          <th
            className="border border-gray-300 bg-gray-100 px-3 py-2 text-left text-sm font-semibold"
            {...props}
          />
        ),
        td: ({ ...props }) => (
          <td className="border border-gray-300 px-3 py-2 text-sm" {...props} />
        ),

        // NEW: SPAN implementation for citations
        span: ({ node, ...props }) => {
          const { id, className, children } = props as {
            id?: string;
            className?: string;
            children?: React.ReactNode;
          };

          const isCite =
            className?.split(" ").includes(searchSpanClass) ?? false;
          const guid = id || "";

          const onClick: React.MouseEventHandler<HTMLSpanElement> | undefined =
            isCite && guid
              ? (e) => {
                  e.preventDefault();
                  handleCiteClick(guid);
                }
              : undefined;

          return (
            <span
              {...props}
              onClick={onClick}
              className={
                isCite
                  ? `cursor-pointer font-semibold underline ${className ?? ""}`
                  : className
              }
            >
              {children}
            </span>
          );
        },

        // existing <a> override stays as-is
        a: ({ node, href, children, ...props }) => {
          if (!href) return <>{children}</>;

          const isCiteLink = href.startsWith("/cite?");

          const onClick: React.MouseEventHandler<HTMLAnchorElement> | undefined =
            isCiteLink
              ? (e) => {
                  e.preventDefault();
                  // reuse your existing handler
                  // or parse guid from href if needed
                  // handleCiteClickFromHref(href)
                }
              : undefined;

          return (
            <a
              href={href}
              onClick={onClick}
              className={
                isCiteLink
                  ? "font-semibold hover:underline cursor-pointer"
                  : "text-blue-500 hover:underline"
              }
              {...props}
            >
              {children}
            </a>
          );
        },
      }}
    >
      {sectionContent.responseText}
    </ReactMarkdown>
  );
}
