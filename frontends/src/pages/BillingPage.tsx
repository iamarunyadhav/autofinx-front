import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Receipt,
  Crown,
  Check,
  Sparkles,
  Download,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { AppShell } from '@/components/layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePlans, useSubscription, useInvoices, useSubscribePlan, useCancelSubscription } from '@/hooks/useBilling';
import { PaymentMethods } from '@/components/billing/PaymentMethods';

const planIcons: Record<string, typeof Crown> = {
  starter: Sparkles,
  pro: Crown,
  enterprise: Crown,
};

export default function BillingPage() {
  const { currentWorkspace } = useWorkspace();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription(currentWorkspace?.id);
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(currentWorkspace?.id);
  const subscribePlan = useSubscribePlan();
  const cancelSubscription = useCancelSubscription();
  const [activeTab, setActiveTab] = useState('subscription');

  const formatCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
        return 'bg-running/10 text-running border-running/30';
      case 'trialing':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'past_due':
      case 'overdue':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'cancelled':
      case 'failed':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const currentPlanId = subscription?.plan_id;
  const checkoutUrl = subscription?.invoice?.metadata?.checkout_url;
  const clientSecret = subscription?.invoice?.metadata?.client_secret;

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription and view invoices (demo mode).</p>
        </div>

        <Tabs defaultValue="subscription" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="subscription" className="gap-2">
              <Crown className="h-4 w-4" />
              Plan
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payment
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <Receipt className="h-4 w-4" />
              Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscription" className="space-y-6">
            {subscriptionLoading ? (
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ) : subscription ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/20">
                          <Crown className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {subscription.invoice?.metadata?.plan || 'Current Plan'}
                            <Badge variant="outline" className={getStatusColor(subscription.status)}>
                              {subscription.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {subscription.invoice?.description || 'Subscription active (demo)'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">
                          {formatCurrency(subscription.invoice?.amount || 0, subscription.invoice?.currency || 'USD')}
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Next billing:{' '}
                          {subscription.current_period_end
                            ? format(new Date(subscription.current_period_end), 'MMM dd, yyyy')
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-warning">
                        <AlertCircle className="h-4 w-4" />
                        <span>Demo billing (no charge)</span>
                      </div>
                    </div>
                    {(checkoutUrl || clientSecret) && (
                      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Complete Payment</p>
                          <p className="text-xs text-muted-foreground">
                            We generated a gateway session. Open the checkout link or use the client secret to confirm.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {checkoutUrl && (
                            <Button asChild size="sm">
                              <a href={checkoutUrl} target="_blank" rel="noreferrer">
                                Pay Now
                              </a>
                            </Button>
                          )}
                          {clientSecret && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(clientSecret)}
                            >
                              Copy Client Secret
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    {currentWorkspace?.id && (
                      <div className="mt-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => cancelSubscription.mutate({ workspaceId: currentWorkspace.id! })}
                          disabled={cancelSubscription.isPending}
                        >
                          {cancelSubscription.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Cancel Subscription
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Crown className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Active Subscription</h3>
                  <p className="text-muted-foreground text-center max-w-sm mb-4">
                    Choose a plan below to get started with automated trading
                  </p>
                </CardContent>
              </Card>
            )}

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Available Plans</h2>
              {plansLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-8 w-32" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-32 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : plans && plans.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((plan, index) => {
                    const isCurrent = currentPlanId === plan.id;
                    const PlanIcon = planIcons[plan.slug] || Sparkles;
                    const features = (plan.features as string[]) || [];

                    return (
                      <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className={`relative h-full ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
                          {isCurrent && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <Badge className="bg-primary text-primary-foreground">Current Plan</Badge>
                            </div>
                          )}
                          <CardHeader>
                            <div className="flex items-center gap-2">
                              <PlanIcon className="h-5 w-5 text-primary" />
                              <CardTitle>{plan.name}</CardTitle>
                            </div>
                            <div className="mt-2">
                              <span className="text-3xl font-bold text-foreground">
                                {formatCurrency(plan.price, plan.currency || 'USD')}
                              </span>
                              <span className="text-muted-foreground">/{plan.interval || 'month'}</span>
                            </div>
                            <CardDescription>{plan.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <ul className="space-y-2">
                              {features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                  <Check className="h-4 w-4 text-running" />
                                  <span className="text-muted-foreground">{feature}</span>
                                </li>
                              ))}
                            </ul>
                            <Button
                              className="w-full"
                              variant={isCurrent ? 'outline' : 'default'}
                              disabled={isCurrent || !currentWorkspace?.id || subscribePlan.isPending}
                              onClick={() =>
                                currentWorkspace?.id &&
                                subscribePlan.mutate({ workspaceId: currentWorkspace.id, planId: plan.id })
                              }
                            >
                              {isCurrent ? 'Current Plan' : 'Choose Plan'}
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">No plans available</CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="payment" className="space-y-6">
            <PaymentMethods workspaceId={currentWorkspace?.id} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Withdrawal & Settlement Flow</CardTitle>
                <CardDescription>
                  Choose a default payout rail and keep banking details ready for manual review.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <p className="text-foreground font-semibold">Priority</p>
                  <p>We use your default method for withdrawals. If none is set, we fall back to the newest bank/Payoneer rail.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-foreground font-semibold">Bank Sync</p>
                  <p>Add account number / routing under Bank Transfer to enable direct settlement after profits are realized.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-foreground font-semibold">Security</p>
                  <p>API keys stay in Supabase; only masked labels are rendered in the UI. Rotate secrets and re-save if you change gateways.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Invoice History</h2>

            {invoicesLoading ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : invoices && invoices.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {invoices.map((invoice: any) => (
                      <div key={invoice.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-muted">
                            <Receipt className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.created_at && format(new Date(invoice.created_at), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className={getStatusColor(invoice.status || 'pending')}>
                            {invoice.status}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {formatCurrency(invoice.amount, invoice.currency || 'USD')}
                          </span>
                          {invoice.pdf_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Invoices Yet</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Your invoices will appear here once you subscribe to a plan
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
