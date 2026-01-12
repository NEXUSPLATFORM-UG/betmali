import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, MessageSquare } from "lucide-react";
import { Link } from "wouter";

export default function InfoPage({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h1 className="text-3xl font-black text-primary italic uppercase tracking-tighter">{title}</h1>
          <Link href="/">
            <Button variant="ghost" className="text-xs font-bold">BACK TO HOME</Button>
          </Link>
        </div>
        <div className="prose prose-invert max-w-none text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  return (
    <InfoPage title="Contact Us">
      <div className="grid md:grid-cols-2 gap-8 not-prose">
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Get in Touch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Email</p>
                <p className="text-sm font-medium">support@betmali.site</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Phone (Uganda)</p>
                <p className="text-sm font-medium">256760734679, 256741321420</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Office</p>
                <p className="text-sm font-medium">Kampala, Uganda</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Live Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">Our team is available 24/7 to help you with any betting or account questions.</p>
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest gap-2">
              <MessageSquare className="w-4 h-4" /> START LIVE CHAT
            </Button>
          </CardContent>
        </Card>
      </div>
    </InfoPage>
  );
}

export function AboutPage() {
  return (
    <InfoPage title="About Us">
      <p className="text-lg font-medium text-foreground mb-4">Welcome to betmali, Uganda's premier sports betting destination.</p>
      <p>betmali is a modern, secure, and user-focused betting platform designed specifically for the East African market. We provide the most competitive odds across a wide range of sports, including football, basketball, and our popular virtual soccer leagues.</p>
      <h3 className="text-primary font-bold mt-6 mb-2">Our Mission</h3>
      <p>Our mission is to provide a transparent, fair, and exciting betting environment where players can enjoy their passion for sports with the highest level of security and customer service.</p>
    </InfoPage>
  );
}

export function TermsPage() {
  return (
    <InfoPage title="Terms & Conditions">
      <h3 className="text-primary font-bold mt-6 mb-2">1. Acceptance of Terms</h3>
      <p>By accessing and using betmali, you agree to be bound by these Terms and Conditions. You must be at least 18 years old to use our services.</p>
      <h3 className="text-primary font-bold mt-6 mb-2">2. Account Registration</h3>
      <p>Users must provide accurate information during registration. One account per person is permitted. You are responsible for maintaining the confidentiality of your account details.</p>
      <h3 className="text-primary font-bold mt-6 mb-2">3. Betting Rules</h3>
      <p>All bets are subject to our specific sport rules. Once a bet is placed and confirmed, it cannot be cancelled or changed by the user.</p>
    </InfoPage>
  );
}

export function ResponsibleGamingPage() {
  return (
    <InfoPage title="Responsible Gaming">
      <p className="text-lg font-medium text-foreground mb-4">Gaming should always be about fun and entertainment.</p>
      <p>At betmali, we take responsible gaming seriously. We provide tools and resources to help you stay in control of your betting activities.</p>
      <h3 className="text-primary font-bold mt-6 mb-2">Staying in Control</h3>
      <ul>
        <li>Set daily, weekly, or monthly deposit limits</li>
        <li>Never bet with money you cannot afford to lose</li>
        <li>Don't chase losses</li>
        <li>Take regular breaks</li>
      </ul>
      <h3 className="text-primary font-bold mt-6 mb-2">Help and Support</h3>
      <p>If you feel that your gaming is becoming a problem, please contact our support team immediately or reach out to professional counseling services.</p>
    </InfoPage>
  );
}

export function PrivacyPolicyPage() {
  return (
    <InfoPage title="Privacy Policy">
      <p>Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.</p>
      <h3 className="text-primary font-bold mt-6 mb-2">Information We Collect</h3>
      <p>We collect information necessary for account verification, transaction processing, and improving our services, including your phone number and transaction history.</p>
      <h3 className="text-primary font-bold mt-6 mb-2">Data Security</h3>
      <p>We use industry-standard encryption and security measures to protect your data from unauthorized access or disclosure.</p>
    </InfoPage>
  );
}
