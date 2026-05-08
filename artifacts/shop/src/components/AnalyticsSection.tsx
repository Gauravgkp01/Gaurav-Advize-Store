import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  MousePointerClick, TrendingUp, Award, AlertTriangle,
  Flame, Star, Package, BarChart2,
} from "lucide-react";
import { Link } from "wouter";
import type { AnalyticsSummary } from "@/lib/api";

interface AnalyticsSectionProps {
  liveData?: AnalyticsSummary | null;
}

function MetricTile({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card border rounded-2xl p-3 sm:p-4 flex flex-col gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">{label}</p>
      <p className="text-lg sm:text-2xl font-extrabold text-foreground leading-tight">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color ?? "#22c55e" }}>
            {p.name}: <span className="font-bold">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[140px] text-muted-foreground/40 gap-2">
      <BarChart2 className="h-8 w-8" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

export function AnalyticsSection({ liveData }: AnalyticsSectionProps) {
  const productClicks = liveData?.productClicks ?? [];
  const weeklyClicks = liveData?.weeklyClicks ?? [];
  const categoryBreakdown = liveData?.categoryBreakdown ?? [];
  const maxClicks = productClicks[0]?.clicks ?? 1;
  const totalCatClicks = categoryBreakdown.reduce((s, c) => s + c.clicks, 0) || 1;
  const hasClicks = (liveData?.totalClicks ?? 0) > 0;

  return (
    <div className="space-y-5" data-testid="analytics-section">

      {/* Section header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-base sm:text-xl font-bold text-foreground">Store Analytics</h2>
        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium ml-1">
          Live data
        </span>
      </div>

      {/* 4 live metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <MetricTile
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Product Clicks"
          value={(liveData?.totalClicks ?? 0).toLocaleString()}
          sub="across all products"
          color="bg-sky-100 text-sky-600"
        />
        <MetricTile
          icon={<Star className="h-4 w-4" />}
          label="Total Reviews"
          value={liveData?.totalReviews ?? 0}
          sub={liveData?.avgRating ? `avg ${liveData.avgRating} ★` : "no reviews yet"}
          color="bg-amber-100 text-amber-600"
        />
        <MetricTile
          icon={<Package className="h-4 w-4" />}
          label="In Stock"
          value={liveData?.inStock ?? 0}
          sub={`${liveData?.outOfStock ?? 0} out of stock`}
          color="bg-green-100 text-green-600"
        />
        <MetricTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Out of Stock"
          value={liveData?.outOfStock ?? 0}
          sub={liveData?.outOfStock ? "needs restocking" : "all products stocked"}
          color="bg-red-100 text-red-600"
        />
      </div>

      {/* Weekly clicks trend (real data) */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5">
        <p className="text-sm font-semibold mb-1">Weekly Clicks</p>
        <p className="text-[11px] text-muted-foreground mb-4">Product clicks over the last 7 days</p>
        {!hasClicks ? (
          <EmptyChart message="No clicks yet — share your store to get started!" />
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={weeklyClicks} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="clicks"
                name="Clicks"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#clickGrad)"
                dot={{ r: 3, fill: "#22c55e" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Most / Least clicked highlight */}
      {hasClicks && liveData?.mostClicked && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="bg-muted border border-border rounded-2xl p-3 sm:p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-primary mb-1">
              <Award className="h-4 w-4" />
              <span className="text-xs font-semibold">Most Clicked</span>
            </div>
            <Link
              href={`/product/${liveData.mostClicked.productId}?from=dashboard`}
              className="text-xs sm:text-sm font-bold text-foreground line-clamp-2 hover:text-primary hover:underline underline-offset-2 transition-colors"
            >
              {liveData.mostClicked.name}
            </Link>
            <div className="flex items-center gap-1.5 mt-1">
              <Flame className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-extrabold text-primary">
                {liveData.mostClicked.clicks.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">clicks</span>
            </div>
          </div>

          {liveData.leastClicked && productClicks.length > 1 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 sm:p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-red-600 mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-semibold">Needs Attention</span>
              </div>
              <Link
                href={`/product/${liveData.leastClicked.productId}?from=dashboard`}
                className="text-xs sm:text-sm font-bold text-foreground line-clamp-2 hover:text-primary hover:underline underline-offset-2 transition-colors"
              >
                {liveData.leastClicked.name}
              </Link>
              <div className="flex items-center gap-1.5 mt-1">
                <MousePointerClick className="h-3.5 w-3.5 text-red-500" />
                <span className="text-sm font-extrabold text-red-600">
                  {liveData.leastClicked.clicks.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground">clicks</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clicks per product bar */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5">
        <p className="text-sm font-semibold mb-4">Clicks per Product</p>
        {productClicks.length === 0 ? (
          <EmptyChart message="No product clicks tracked yet" />
        ) : (
          <div className="space-y-2.5">
            {productClicks.map((p, i) => {
              const pct = maxClicks > 0 ? Math.round((p.clicks / maxClicks) * 100) : 0;
              const isTop = i === 0;
              const isBottom = i === productClicks.length - 1 && productClicks.length > 1;
              return (
                <div key={p.productId}>
                  <div className="flex items-center justify-between mb-1">
                    <Link
                      href={`/product/${p.productId}?from=dashboard`}
                      className="text-[11px] sm:text-xs text-foreground font-medium truncate max-w-[60%] hover:text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-1.5">
                      {isTop && (
                        <span className="text-[9px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                          🔥 Top
                        </span>
                      )}
                      {isBottom && (
                        <span className="text-[9px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">
                          Low
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-foreground">{p.clicks}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isTop ? "bg-green-500" : isBottom ? "bg-red-400" : "bg-primary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category breakdown (real click data) */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5">
        <p className="text-sm font-semibold mb-4">Clicks by Category</p>
        {categoryBreakdown.length === 0 || !hasClicks ? (
          <EmptyChart message="No category data yet — add products to see this chart" />
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-full sm:w-1/2" style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBreakdown}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="clicks" name="Clicks" radius={[4, 4, 0, 0]}>
                    {categoryBreakdown.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full sm:w-1/2 space-y-2">
              {categoryBreakdown.map(cat => {
                const pct = Math.round((cat.clicks / totalCatClicks) * 100);
                return (
                  <div key={cat.category} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
                    <span className="text-xs text-foreground font-medium flex-1 truncate">{cat.category}</span>
                    <span className="text-xs text-muted-foreground">{cat.clicks}</span>
                    <span className="text-xs font-bold" style={{ color: cat.color }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
