import { Shield, Lock, Users, Ban, Eye, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const SecurityPage = () => {
  const securityFeatures = [
    {
      icon: Lock,
      title: "Strong encryption for your files",
      description:
        "Your files are encrypted both while traveling to our servers and while they are stored. We use modern encryption standards such as AES-256 for stored data and TLS for data in transit. In plain English: your files are locked with keys that would take massive computing power and unrealistic time to break.",
    },
    {
      icon: Users,
      title: "Only you control who receives your information",
      description:
        "Your data is never visible to other users unless you explicitly authorize it. You choose your trusted contacts and decide exactly what is shared and under what conditions. Until those conditions are met, all stored data remains encrypted and inaccessible.",
    },
    {
      icon: Shield,
      title: "Account security with two-factor authentication",
      description:
        "You can enable two-factor authentication so logging in requires both your password and a time-based code from an authenticator app. This protects your account even if someone else discovers your password.",
    },
    {
      icon: Ban,
      title: "Data is never sold",
      description:
        "We don't rent, sell, or \"monetize\" your data. Your documents are used only to provide the service you signed up for.",
    },
    {
      icon: Eye,
      title: "Limited internal access",
      description:
        "We design our systems so that sensitive information is processed automatically. Human access is restricted, logged, and only granted when absolutely necessary for security or support reasons.",
    },
    {
      icon: Trash2,
      title: "You stay in control of your files",
      description:
        "You can remove your documents or your account whenever you choose. When you delete your data, it is removed from active systems instead of being kept indefinitely.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            How we keep your data safe
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your privacy and security are central to how this service is built.
            Everything you upload is protected using the same class of
            encryption relied on by banks and modern operating systems.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid gap-8">
            {securityFeatures.map((feature, index) => (
              <Card
                key={index}
                className="border-border/50 bg-card/50 backdrop-blur-sm"
              >
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <feature.icon className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-3">
                        {feature.title}
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SecurityPage;
