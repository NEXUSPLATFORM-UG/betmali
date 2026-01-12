import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import MyBets from "@/pages/MyBets";
import VirtualBets from "@/pages/VirtualBets";
import MyOffers from "@/pages/MyOffers";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import { AboutPage, TermsPage, ResponsibleGamingPage, PrivacyPolicyPage, ContactPage } from "@/pages/InfoPages";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/my-bets" component={MyBets} />
      <Route path="/virtual-bets" component={VirtualBets} />
      <Route path="/my-offers" component={MyOffers} />
      <Route path="/settings" component={Settings} />
      <Route path="/about" component={AboutPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/responsible-gaming" component={ResponsibleGamingPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/contact" component={ContactPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
