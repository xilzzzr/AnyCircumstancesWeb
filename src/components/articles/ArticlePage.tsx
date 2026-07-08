import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/seo/Seo";

type ArticlePageProps = {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
};

const ArticlePage = ({ title, description, path, children }: ArticlePageProps) => {
  return (
    <>
      <Seo title={title} description={description} path={path} />

    
<div className="min-h-screen bg-background">
        <section className="border-b">
          <div className="mx-auto max-w-4xl px-6 py-14">
            <div className="mb-4">
<Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                Home
              </Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">Resources</span>
            </div>

            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              {title}
            </h1>


            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              {description}
            </p>
          </div>
        </section>


        <article className="mx-auto max-w-3xl px-6 py-12">
          <div className="prose prose-neutral max-w-none dark:prose-invert">
            {children}
          </div>


          <div className="mt-12 rounded-2xl border p-6">
            <h2 className="text-2xl font-semibold">Protect what matters</h2>
            <p className="mt-3 text-muted-foreground">
              AnyCircumstances helps you store sensitive files, assign trusted contacts,
              and automate secure release if you miss a check-in.
            </p>
  
           <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Get started
              </Link>
             <Link
                to="/pricing"
                className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium"
              >
                View pricing
              </Link>
              <Link
                to="/security"
                className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium"
              >
Read security details
              </Link>
            </div>
          </div>
        </article>
      </div>
    </>
  );
};

export default ArticlePage;
