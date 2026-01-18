import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataModelTab from "@/components/admin/DataModelTab";
import DatabaseSchemaTab from "@/components/admin/DatabaseSchemaTab";
import ApiContractTab from "@/components/admin/ApiContractTab";
import CreateCompetitionTab from "@/components/admin/CreateCompetitionTab";
import ManageCompetitionsTab from "@/components/admin/ManageCompetitionsTab";
import TradingEngineRulesTab from "@/components/admin/TradingEngineRulesTab";

const AdminBlueprint = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage competitions, view database design, and configure trading engine rules.
          </p>
        </div>

        <Tabs defaultValue="manage-competitions" className="space-y-6">
          <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
            <TabsTrigger value="manage-competitions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Manage Competitions
            </TabsTrigger>
            <TabsTrigger value="create-competition" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Create Competition
            </TabsTrigger>
            <TabsTrigger value="data-model" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Data Model
            </TabsTrigger>
            <TabsTrigger value="schema" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Database Schema
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              API Contract
            </TabsTrigger>
            <TabsTrigger value="engine-rules" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Trading Engine
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage-competitions">
            <ManageCompetitionsTab />
          </TabsContent>

          <TabsContent value="create-competition">
            <CreateCompetitionTab />
          </TabsContent>

          <TabsContent value="data-model">
            <DataModelTab />
          </TabsContent>

          <TabsContent value="schema">
            <DatabaseSchemaTab />
          </TabsContent>

          <TabsContent value="api">
            <ApiContractTab />
          </TabsContent>

          <TabsContent value="engine-rules">
            <TradingEngineRulesTab />
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default AdminBlueprint;

