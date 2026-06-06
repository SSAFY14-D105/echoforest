"""
plot_comparison.py — 9모델 비교 포트폴리오 차트 (presentation layer)
=============================================================================
results/comparison_results.csv 를 읽어 차트를 렌더(재추론 불필요). 영어+한국어.
  ① abuse_recall_before_after.png — 헤드라인: baseline → 파인튜닝 (Abuse Recall 상승)
  ② tradeoff_baseline_vs_best.png — 결정타: 정밀도 약간↓·재현율 크게↑·F1 순이득
  ③ v1_vs_v2.png                  — 게임 데이터 효과(v1 보정만 vs v2 +게임수집)
사용: cd 6_Model_Comparison && python plot_comparison.py
"""
import os, pandas as pd, numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.font_manager as fm
from matplotlib.lines import Line2D

def _font(c):
    a = {f.name for f in fm.fontManager.ttflist}
    return next((x for x in c if x in a), "DejaVu Sans")
FONT_EN = _font(["Helvetica Neue","Avenir Next","Arial","DejaVu Sans"])
FONT_KO = _font(["Apple SD Gothic Neo","AppleGothic","Nanum Gothic","DejaVu Sans"])
INK,SUB,GRID,NEUTRAL,MUTED,ACCENT,SLATE = "#1F2933","#9AA5B1","#EBEEF1","#C2CAD2","#E0E4E8","#2A9D8F","#4B5A68"
WARN = "#C2703D"  # 정밀도 하락(작은 비용) 표시용

SELECTED = "Full v2 Game"   # F1·LRAP·Precision 1위 → Step 1 기준(F1·정밀도)과 일관

STR = {
 "en": {"h_title":"Fine-tuning lifts abuse recall","h_word":"fine-tuned up to","h_xlabel":"Abuse Recall  (%)",
        "before":"baseline","selected":"selected",
        "t_title":"The trade-off — a little precision for a lot of recall",
        "t_sub":"Baseline vs selected (Full v2 Game) · F1 confirms the net win",
        "v_title":"Game data is what matters — v1 vs v2","v_sub":"v1 = corrected unSmile only   ·   v2 = + 518 collected game lines",
        "v_xlabel":"Abuse Recall  (%)","v1":"v1 (correction only)","v2":"v2 (+ game data)"},
 "ko": {"h_title":"파인튜닝이 욕설 탐지율을 끌어올린다","h_word":"파인튜닝 최대","h_xlabel":"Abuse Recall  (%)",
        "before":"baseline","selected":"선정",
        "t_title":"트레이드오프 — 정밀도 약간 내주고 재현율 크게 얻음",
        "t_sub":"Baseline vs 선정(Full v2 Game) · F1이 순이득을 확인",
        "v_title":"결국 게임 데이터가 핵심 — v1 vs v2","v_sub":"v1 = 보정 unSmile만   ·   v2 = + 수집 게임채팅 518",
        "v_xlabel":"Abuse Recall  (%)","v1":"v1 (보정만)","v2":"v2 (+게임)"},
}

def _style(font):
    plt.rcParams.update({"font.family":font,"font.size":12,"text.color":INK,"axes.labelcolor":SUB,
                         "xtick.color":SUB,"ytick.color":INK,"axes.linewidth":0,"axes.unicode_minus":False})
def _despine(ax, keep=()):
    for k,s in ax.spines.items(): s.set_visible(k in keep)
    ax.tick_params(length=0)
def _title(ax, t, sub):
    ax.set_title(t, loc="left", pad=30, fontsize=17, fontweight="bold", color=INK)
    if sub: ax.text(0,1.045,sub,transform=ax.transAxes,fontsize=10.5,color=SUB,va="bottom")

# ── ① 헤드라인: Abuse Recall 상승 ──────────────────────────────────────────
def chart_headline(df, path, t):
    d = df.sort_values("abuse_recall", ascending=True).reset_index(drop=True)
    base_r = float(df[df["model"]=="Baseline"]["abuse_recall"].iloc[0])*100
    max_r = float(d["abuse_recall"].max())*100
    n = len(d); y = np.arange(n)
    fig, ax = plt.subplots(figsize=(9.6, 0.52*n+2.0))
    fig.subplots_adjust(left=0.27, right=0.965, top=1-1.5/(0.52*n+2.0), bottom=1.0/(0.52*n+2.0))
    colors=[SLATE if m=="Baseline" else (ACCENT if m==SELECTED else NEUTRAL) for m in d["model"]]
    ax.barh(y, d["abuse_recall"]*100, height=0.62, color=colors, zorder=3)
    ax.axvline(base_r, color=SLATE, ls="--", lw=1.3, zorder=2)
    ax.set_yticks(y); ax.set_yticklabels(d["model"], fontsize=12)
    for tick,m in zip(ax.get_yticklabels(), d["model"]):
        if m=="Baseline": tick.set_color(SLATE)
        if m==SELECTED: tick.set_fontweight("bold")
    for i,v in enumerate(d["abuse_recall"]*100):
        m=d["model"].iloc[i]; hot=(m=="Baseline" or m==SELECTED)
        ax.text(v-1.6 if hot else v+1.2, i, f"{v:.1f}", va="center", ha="right" if hot else "left",
                color="white" if hot else INK, fontweight="bold" if hot else "normal", fontsize=11.5, zorder=5)
    bi = int(d.index[d["model"]=="Baseline"][0]); si = int(d.index[d["model"]==SELECTED][0])
    ax.text(base_r+1.5, bi, t["before"], va="center", ha="left", color=SLATE, fontsize=10, fontstyle="italic")
    ax.text(d["abuse_recall"].iloc[si]*100+3.5, si, t["selected"], va="center", ha="left",
            color="white", fontsize=10.5, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.4", facecolor=ACCENT, edgecolor="none"))
    ax.set_xlim(0,100); ax.set_xticks([0,20,40,60,80,100])
    ax.xaxis.grid(True,color=GRID,lw=1.2,zorder=0); ax.set_axisbelow(True); _despine(ax,keep=())
    ax.set_xlabel(t["h_xlabel"], fontsize=10.5)
    _title(ax, t["h_title"], f"test_set 482 · baseline {base_r:.1f}% — {t['h_word']} {max_r:.1f}%  (+{max_r-base_r:.1f}p)")
    fig.savefig(path, dpi=220, facecolor="white"); plt.close(fig); print("saved", path)

# ── ② 트레이드오프 (결정타): baseline vs selected, P/R/F1 ───────────────────
def chart_tradeoff(df, path, t):
    def g(m,k): return float(df[df["model"]==m][k].iloc[0])*100
    base=[g("Baseline","abuse_precision"),g("Baseline","abuse_recall"),g("Baseline","abuse_f1")]
    sel =[g(SELECTED,"abuse_precision"),g(SELECTED,"abuse_recall"),g(SELECTED,"abuse_f1")]
    labels=["Precision","Recall","F1"]; x=np.arange(3); w=0.36
    fig,ax=plt.subplots(figsize=(9.2,5.0)); fig.subplots_adjust(left=0.08,right=0.96,top=0.78,bottom=0.13)
    ax.bar(x-w/2, base, w, color=NEUTRAL, zorder=3, label=t["before"])
    ax.bar(x+w/2, sel,  w, color=ACCENT,  zorder=3, label=f"{t['selected']} · Full v2 Game")
    for xi,(b,s) in enumerate(zip(base,sel)):
        ax.text(xi-w/2, b+1.2, f"{b:.0f}", ha="center", color=SUB, fontsize=11)
        ax.text(xi+w/2, s+1.2, f"{s:.0f}", ha="center", color=INK, fontsize=11, fontweight="bold")
        dv=s-b; col=ACCENT if dv>=0 else WARN
        ax.annotate(f"{dv:+.0f}p", xy=(xi, max(b,s)+7), ha="center", color=col, fontsize=12, fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=12.5)
    ax.set_ylim(0,108); ax.set_yticks([0,25,50,75,100])
    ax.yaxis.grid(True,color=GRID,lw=1.2,zorder=0); ax.set_axisbelow(True); _despine(ax,keep=())
    ax.legend(loc="lower center", bbox_to_anchor=(0.5,-0.16), ncol=2, frameon=False, fontsize=11)
    _title(ax, t["t_title"], t["t_sub"])
    fig.savefig(path, dpi=220, facecolor="white"); plt.close(fig); print("saved", path)

# ── ③ v1 vs v2 ─────────────────────────────────────────────────────────────
def chart_v1v2(df, path, t):
    combos=[("LoRA Game","LoRA v1 Game","LoRA v2 Game"),("LoRA Tutorial","LoRA v1 Tutorial","LoRA v2 Tutorial"),
            ("Full Game","Full v1 Game","Full v2 Game"),("Full Tutorial","Full v1 Tutorial","Full v2 Tutorial")]
    def rec(m):
        r=df[df["model"]==m]["abuse_recall"]; return float(r.iloc[0])*100 if len(r) else np.nan
    rows=[(lab,rec(v1),rec(v2)) for lab,v1,v2 in combos]
    base_r=float(df[df["model"]=="Baseline"]["abuse_recall"].iloc[0])*100
    n=len(rows); y=np.arange(n)
    fig,ax=plt.subplots(figsize=(9.6,4.6)); fig.subplots_adjust(left=0.21,right=0.95,top=0.74,bottom=0.16)
    for i,(lab,v1,v2) in enumerate(rows):
        ax.plot([v1,v2],[i,i],color=GRID,lw=4,zorder=1,solid_capstyle="round")
        ax.scatter(v1,i,s=140,color=NEUTRAL,zorder=3); ax.scatter(v2,i,s=140,color=ACCENT,zorder=3)
        ax.text(v1,i+0.2,f"{v1:.0f}",ha="center",va="bottom",color=SUB,fontsize=9.5)
        ax.text(v2,i+0.2,f"{v2:.0f}",ha="center",va="bottom",color=ACCENT,fontsize=9.5,fontweight="bold")
        ax.annotate("", xy=(v2-1,i), xytext=(v1+1,i), arrowprops=dict(arrowstyle="->",color=ACCENT,lw=1.3))
    ax.axvline(base_r,color=SLATE,ls="--",lw=1.2,zorder=1)
    ax.text(base_r,n-0.4,f"baseline {base_r:.0f}",color=SLATE,fontsize=9,ha="center")
    ax.set_yticks(y); ax.set_yticklabels([r[0] for r in rows],fontsize=12)
    ax.set_xlim(0,100); ax.set_ylim(-0.6,n-1+0.8); ax.set_xticks([0,20,40,60,80,100])
    ax.xaxis.grid(True,color=GRID,lw=1.2,zorder=0); ax.set_axisbelow(True); _despine(ax,keep=())
    ax.set_xlabel(t["v_xlabel"],fontsize=10.5)
    ax.legend(handles=[Line2D([0],[0],marker="o",color="w",markerfacecolor=NEUTRAL,markersize=10,label=t["v1"]),
                       Line2D([0],[0],marker="o",color="w",markerfacecolor=ACCENT,markersize=10,label=t["v2"])],
              loc="center left",frameon=False,fontsize=10.5)
    _title(ax,t["v_title"],t["v_sub"])
    fig.savefig(path,dpi=220,facecolor="white"); plt.close(fig); print("saved",path)

def render(csv, out, lang="en", sfx=""):
    _style(FONT_KO if lang=="ko" else FONT_EN)
    df=pd.read_csv(csv, encoding="utf-8-sig")
    chart_headline(df, os.path.join(out,f"abuse_recall_before_after{sfx}.png"), STR[lang])
    chart_tradeoff(df, os.path.join(out,f"tradeoff_baseline_vs_best{sfx}.png"), STR[lang])
    chart_v1v2(df, os.path.join(out,f"v1_vs_v2{sfx}.png"), STR[lang])

if __name__=="__main__":
    here=os.path.dirname(os.path.abspath(__file__)); csv=os.path.join(here,"results","comparison_results.csv"); out=os.path.join(here,"results")
    render(csv,out,"en",""); render(csv,out,"ko","_ko")
