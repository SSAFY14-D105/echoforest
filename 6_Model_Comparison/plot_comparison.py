"""
plot_comparison.py — 9모델 비교 포트폴리오 차트 (presentation layer)
=============================================================================
results/comparison_results.csv 를 읽어 차트를 렌더(재추론 불필요). 영어+한국어.
  ① abuse_recall_before_after.png  — 헤드라인: baseline → 파인튜닝 (Abuse Recall)
  ② v1_vs_v2.png                   — 게임 데이터 효과(v1 보정만 vs v2 +게임수집)
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

STR = {
 "en": {"h_title":"Fine-tuning lifts abuse recall","h_xlabel":"Abuse Recall  (%)","before":"baseline","best":"best",
        "v_title":"Game data is what matters — v1 vs v2","v_sub":"v1 = corrected unSmile only   ·   v2 = + 518 collected game lines",
        "v_xlabel":"Abuse Recall  (%)","v1":"v1 (no game)","v2":"v2 (+ game)"},
 "ko": {"h_title":"파인튜닝이 욕설 탐지율을 끌어올린다","h_xlabel":"Abuse Recall  (%)","before":"baseline","best":"최고",
        "v_title":"결국 게임 데이터가 핵심 — v1 vs v2","v_sub":"v1 = 보정 unSmile만   ·   v2 = + 수집 게임채팅 518",
        "v_xlabel":"Abuse Recall  (%)","v1":"v1 (게임X)","v2":"v2 (+게임)"},
}

def _style(font):
    plt.rcParams.update({"font.family":font,"font.size":12,"text.color":INK,"axes.labelcolor":SUB,
                         "xtick.color":SUB,"ytick.color":INK,"axes.linewidth":0,"axes.unicode_minus":False})
def _despine(ax):
    for s in ax.spines.values(): s.set_visible(False)
    ax.tick_params(length=0)
def _title(ax, t, sub):
    ax.set_title(t, loc="left", pad=30, fontsize=17, fontweight="bold", color=INK)
    if sub: ax.text(0,1.045,sub,transform=ax.transAxes,fontsize=10.5,color=SUB,va="bottom")

# ── ① 헤드라인: baseline → 파인튜닝 (Abuse Recall) ──────────────────────────
def chart_headline(df, path, t):
    d = df.sort_values("abuse_recall", ascending=True).reset_index(drop=True)
    base_r = float(df[df["model"]=="Baseline"]["abuse_recall"].iloc[0])*100
    best_i = d["abuse_recall"].idxmax()
    n = len(d); y = np.arange(n)
    fig, ax = plt.subplots(figsize=(9.6, 0.52*n+2.0))
    fig.subplots_adjust(left=0.27, right=0.965, top=1-1.5/(0.52*n+2.0), bottom=1.0/(0.52*n+2.0))
    colors=[]
    for i,m in enumerate(d["model"]):
        colors.append(SLATE if m=="Baseline" else (ACCENT if i==best_i else NEUTRAL))
    ax.barh(y, d["abuse_recall"]*100, height=0.62, color=colors, zorder=3)
    ax.axvline(base_r, color=SLATE, ls="--", lw=1.3, zorder=2)
    ax.set_yticks(y); ax.set_yticklabels(d["model"], fontsize=12)
    for tick,m in zip(ax.get_yticklabels(), d["model"]):
        if m=="Baseline": tick.set_color(SLATE)
    for i,v in enumerate(d["abuse_recall"]*100):
        m=d["model"].iloc[i]; hot=(m=="Baseline" or i==best_i)
        ax.text(v-1.6 if hot else v+1.2, i, f"{v:.1f}", va="center", ha="right" if hot else "left",
                color="white" if hot else INK, fontweight="bold" if hot else "normal", fontsize=11.5, zorder=5)
    # baseline / best 태그
    bi = int(d.index[d["model"]=="Baseline"][0])
    ax.text(base_r+1.5, bi, t["before"], va="center", ha="left", color=SLATE, fontsize=10, fontstyle="italic")
    ax.text(d["abuse_recall"].iloc[best_i]*100+3.5, best_i, t["best"], va="center", ha="left",
            color="white", fontsize=10.5, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.4", facecolor=ACCENT, edgecolor="none"))
    ax.set_xlim(0,100); ax.set_xticks([0,20,40,60,80,100])
    ax.xaxis.grid(True,color=GRID,lw=1.2,zorder=0); ax.set_axisbelow(True); _despine(ax)
    ax.set_xlabel(t["h_xlabel"], fontsize=10.5)
    best_r=d["abuse_recall"].iloc[best_i]*100
    _title(ax, t["h_title"], f"test_set 482 · baseline {base_r:.1f}% — {t['best']} {best_r:.1f}%  (+{best_r-base_r:.1f}p)")
    fig.savefig(path, dpi=220, facecolor="white"); plt.close(fig); print("saved", path)

# ── ② v1 vs v2 (게임 데이터 효과) ──────────────────────────────────────────
def chart_v1v2(df, path, t):
    combos = [("LoRA Game","LoRA v1 Game","LoRA v2 Game"),("LoRA Tutorial","LoRA v1 Tutorial","LoRA v2 Tutorial"),
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
    ax.xaxis.grid(True,color=GRID,lw=1.2,zorder=0); ax.set_axisbelow(True); _despine(ax)
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
    chart_v1v2(df, os.path.join(out,f"v1_vs_v2{sfx}.png"), STR[lang])

if __name__=="__main__":
    here=os.path.dirname(os.path.abspath(__file__)); csv=os.path.join(here,"results","comparison_results.csv"); out=os.path.join(here,"results")
    render(csv,out,"en",""); render(csv,out,"ko","_ko")
