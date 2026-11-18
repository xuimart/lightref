using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace Xuimart.LightRefInstaller
{
    static class Design
    {
        public static readonly Color Background = ColorTranslator.FromHtml("#0e0e14"), Card = ColorTranslator.FromHtml("#181822"),
            Panel = ColorTranslator.FromHtml("#20202e"), Accent = ColorTranslator.FromHtml("#de2246"),
            Text = ColorTranslator.FromHtml("#f0f0ff"), Dim = ColorTranslator.FromHtml("#8c8ca5"),
            Border = ColorTranslator.FromHtml("#37374b"), Success = ColorTranslator.FromHtml("#22c864");
        public static GraphicsPath Round(RectangleF r, float radius)
        {
            float d = radius * 2; var p = new GraphicsPath();
            p.AddArc(r.X,r.Y,d,d,180,90); p.AddArc(r.Right-d,r.Y,d,d,270,90);
            p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90); p.AddArc(r.X,r.Bottom-d,d,d,90,90); p.CloseFigure(); return p;
        }
        public static void Box(Graphics g, RectangleF r, Color fill, Color border, float radius)
        {
            using (var p = Round(r,radius)) {
                using (var b = new SolidBrush(fill)) g.FillPath(b,p);
                if (border != Color.Empty) using (var pen = new Pen(border)) g.DrawPath(pen,p);
            }
        }
        public static void Write(Graphics g, string text, float x, float y, float w, float h, float size, Color color, bool bold)
        {
            // Coordinates use a 96-DPI canvas; pixel fonts avoid applying the
            // monitor DPI twice when the entire canvas is scaled by OnPaint.
            using (var f = new Font("Segoe UI",size*96f/72f,bold ? FontStyle.Bold : FontStyle.Regular,GraphicsUnit.Pixel))
            using (var b = new SolidBrush(color))
            using (var format = new StringFormat { Trimming=StringTrimming.EllipsisCharacter, FormatFlags=StringFormatFlags.NoWrap, LineAlignment=StringAlignment.Center })
                g.DrawString(text,f,b,new RectangleF(x,y,w,h),format);
        }
        public static void Check(Graphics g, float x, float y, Color color)
        {
            using (var p = new Pen(color,1.7f) { StartCap=LineCap.Round, EndCap=LineCap.Round, LineJoin=LineJoin.Round })
                g.DrawLines(p,new [] {new PointF(x,y+5),new PointF(x+4,y+9),new PointF(x+11,y)});
        }
    }

    sealed class BrandButton : Button
    {
        public bool Primary;
        bool hover, pressed;
        public BrandButton()
        {
            SetStyle(ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);
            FlatStyle=FlatStyle.Flat; FlatAppearance.BorderSize=0; Cursor=Cursors.Hand;
            BackColor=Design.Background; ForeColor=Design.Text; Font=new Font("Segoe UI",9f,FontStyle.Bold);
        }
        protected override void OnMouseEnter(EventArgs e) { hover=true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hover=false; pressed=false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { pressed=true; Invalidate(); base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { pressed=false; Invalidate(); base.OnMouseUp(e); }
        protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
        protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g=e.Graphics; g.SmoothingMode=SmoothingMode.AntiAlias;
            Color fill=Primary ? Design.Accent : Design.Panel;
            if (hover) fill=Primary ? Color.FromArgb(239,47,83) : Color.FromArgb(45,45,61);
            if (pressed) fill=Primary ? Color.FromArgb(184,24,56) : Design.Card;
            if (!Enabled) fill=Design.Panel;
            float scale=Height/42f;
            Design.Box(g,new RectangleF(1,1,Width-3,Height-3),fill,Primary ? Color.Empty : Design.Border,Math.Min(9,8*scale));
            TextRenderer.DrawText(g,Text,Font,ClientRectangle,Enabled ? Design.Text : Design.Dim,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.NoPrefix);
            if (Focused && ShowFocusCues) using (var p=new Pen(Design.Text)) {
                p.DashStyle=DashStyle.Dot; using(var path=Design.Round(new RectangleF(5,5,Width-11,Height-11),5)) g.DrawPath(p,path);
            }
        }
    }

    sealed class PhotoshopRow : Control
    {
        readonly string name;
        public PhotoshopRow(string path)
        {
            name=Path.GetFileName(path).Replace("Adobe ",""); Text=name; AccessibleName=name; AccessibleDescription=path;
            Height=54; BackColor=Design.Card;
            SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint,true);
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            var g=e.Graphics; float s=Height/54f; g.ScaleTransform(s,s); g.SmoothingMode=SmoothingMode.AntiAlias;
            Design.Box(g,new RectangleF(0,7,34,34),Color.FromArgb(14,35,56),Color.FromArgb(39,72,101),8);
            Design.Write(g,"Ps",7,9,26,28,12,Color.FromArgb(126,200,255),true);
            Design.Write(g,name.Replace("Photoshop ",""),46,5,125,24,10,Design.Text,true);
            Design.Write(g,"Detectado",46,28,125,18,8,Design.Dim,false);
            Design.Check(g,Width/s-15,20,Design.Success);
        }
    }

    sealed class InstallerForm : Form
    {
        bool busy, completed, details;
        string state="ready", status="Pronto para instalar", failure="";
        int progress;
        readonly List<string> photoshop;
        readonly BrandButton installBtn, closeBtn, detailsBtn, browseBtn;
        readonly Panel versions;
        readonly ListBox log;
        readonly ToolTip hints = new ToolTip();
        Image logo;

        public InstallerForm()
        {
            Text="LightRef · Instalação";
            AutoScaleDimensions=new SizeF(96,96); AutoScaleMode=AutoScaleMode.Dpi;
            ClientSize=new Size(780,540); StartPosition=FormStartPosition.CenterScreen;
            BackColor=Design.Background; ForeColor=Design.Text; Font=new Font("Segoe UI",9f);
            FormBorderStyle=FormBorderStyle.FixedSingle; MaximizeBox=false;
            DoubleBuffered=true; Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            AccessibleDescription="Instalador LightRef para Photoshop, desenvolvido por Xuimart.";
            using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("xuimart.png"))
                if(stream!=null) using(var source=Image.FromStream(stream)) logo=new Bitmap(source);

            photoshop=Core.DetectPhotoshop().OrderByDescending(p=>Path.GetFileName(p)).ToList();
            versions=new Panel {Left=42,Top=174,Width=196,Height=174,BackColor=Design.Card,AutoScroll=true};
            Controls.Add(versions); RefreshVersions();
            browseBtn=Button("Localizar Photoshop…",42,360,196,32,false);
            browseBtn.Click+=(s,e)=>BrowsePhotoshop();
            log=new ListBox {Left=294,Top=207,Width=440,Height=146,BorderStyle=BorderStyle.None,
                BackColor=Design.Card,ForeColor=Design.Dim,Font=new Font("Segoe UI",9f),Visible=false,
                IntegralHeight=false,HorizontalScrollbar=true,DrawMode=DrawMode.OwnerDrawFixed,ItemHeight=22,AccessibleName="Detalhes da instalação"};
            log.DrawItem+=(s,e)=> {
                if(e.Index<0)return;
                e.DrawBackground(); string line=log.Items[e.Index].ToString();
                TextRenderer.DrawText(e.Graphics,line,e.Font,e.Bounds,line.StartsWith("ERRO") ? Color.FromArgb(239,108,108) : Design.Dim,TextFormatFlags.NoPrefix|TextFormatFlags.NoPadding|TextFormatFlags.VerticalCenter);
                e.DrawFocusRectangle();
            };
            log.KeyDown+=(s,e)=> {
                if(e.Control && e.KeyCode==Keys.C && log.Items.Count>0) {
                    Clipboard.SetText(string.Join(Environment.NewLine,log.Items.Cast<string>().ToArray()));e.SuppressKeyPress=true;
                }
            };
            Controls.Add(log);
            detailsBtn=Button("Ver detalhes",24,458,130,38,false);
            detailsBtn.Click+=(s,e)=>{details=!details; log.Visible=details; detailsBtn.Text=details ? "Ocultar detalhes" : "Ver detalhes"; Invalidate();};
            closeBtn=Button("Cancelar",438,458,112,42,false); closeBtn.Click+=(s,e)=>Close();
            installBtn=Button("Instalar LightRef",562,458,194,42,true);
            installBtn.Click+=(s,e)=> {
                if(completed) {Close();return;}
                if(busy)return;
                busy=true; state="installing"; installBtn.Enabled=false; closeBtn.Enabled=false; browseBtn.Enabled=false;
                installBtn.Text="Instalando…"; status="Preparando instalação"; Invalidate();
                new Thread(RunInstall) {IsBackground=true}.Start();
            };
            AcceptButton=installBtn; CancelButton=closeBtn;
            installBtn.TabIndex=0; closeBtn.TabIndex=1; detailsBtn.TabIndex=2; browseBtn.TabIndex=3;
            FormClosing+=(s,e)=>{if(busy)e.Cancel=true;};
            Log("LightRef " + Core.Version + " · Xuimart");
            foreach(var path in photoshop)Log("Photoshop: "+path);
            Log("Os arquivos estão incluídos neste instalador.");
        }
        BrandButton Button(string text,int x,int y,int w,int h,bool primary)
        {
            var b=new BrandButton {Text=text,Left=x,Top=y,Width=w,Height=h,Primary=primary}; Controls.Add(b); return b;
        }
        void RefreshVersions()
        {
            while(versions.Controls.Count>0)versions.Controls[0].Dispose();
            float scale=ClientSize.Width/780f;
            foreach(string path in photoshop) {
                var row=new PhotoshopRow(path) {Dock=DockStyle.Top,Height=(int)(54*scale)};
                hints.SetToolTip(row,path); versions.Controls.Add(row); row.BringToFront();
            }
            Invalidate();
        }
        void BrowsePhotoshop()
        {
            using(var dialog=new FolderBrowserDialog {Description="Selecione a pasta que contém Photoshop.exe",ShowNewFolderButton=false}) {
                if(dialog.ShowDialog(this)!=DialogResult.OK)return;
                string path=dialog.SelectedPath, exe=Path.Combine(path,"Photoshop.exe");
                if(!File.Exists(exe) || FileVersionInfo.GetVersionInfo(exe).FileMajorPart<19) {
                    MessageBox.Show(this,"Selecione uma instalação do Photoshop 2018 ou mais recente.","Localizar Photoshop",MessageBoxButtons.OK,MessageBoxIcon.Information); return;
                }
                if(!photoshop.Contains(path,StringComparer.OrdinalIgnoreCase))photoshop.Add(path);
                RefreshVersions(); Log("Photoshop adicionado: "+path);
            }
        }
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e); var g=e.Graphics; g.ScaleTransform(ClientSize.Width/780f,ClientSize.Height/540f);
            g.SmoothingMode=SmoothingMode.AntiAlias;
            Design.Write(g,"LightRef",23,23,220,47,28,Design.Text,true);
            Design.Box(g,new RectangleF(253,37,62,25),Design.Panel,Design.Border,6);
            Design.Write(g,"v"+Core.Version,264,36,51,25,8.5f,Design.Dim,false);
            Design.Write(g,"Seu estúdio de luz, dentro do Photoshop.",25,75,580,23,10,Design.Dim,false);
            DrawLight(g);
            Design.Box(g,new RectangleF(24,116,232,296),Design.Card,Design.Border,12);
            Design.Box(g,new RectangleF(272,116,484,296),Design.Card,Design.Border,12);
            Design.Write(g,"PHOTOSHOP",42,133,150,24,8,Design.Dim,true);
            Design.Write(g,photoshop.Count.ToString("00"),209,133,29,24,9,Design.Dim,false);
            if(photoshop.Count==0) {
                Design.Write(g,"Nenhuma versão detectada",42,190,193,28,9,Design.Text,true);
                Design.Write(g,"Localize a pasta para continuar.",42,220,193,24,8,Design.Dim,false);
            }
            string heading=state=="success" ? "Tudo pronto. Boa criação!" : state=="error" ? "Não foi possível concluir" : state=="installing" ? "Preparando seu estúdio…" : "Uma nova luz para sua arte.";
            Design.Write(g,heading,292,132,441,34,18,Design.Text,true);
            string subtitle=state=="success" ? "Reinicie o Photoshop para usar o LightRef." : state=="error" ? "Confira os detalhes e tente novamente." : state=="installing" ? "Mantenha esta janela aberta até a conclusão." : "LightRef será instalado nas versões detectadas.";
            Design.Write(g,subtitle,294,171,440,23,9,Design.Dim,false);
            if(!details) {
                if(state=="success") {
                    Feature(g,213,0,"01  Reinicie o Photoshop","Feche e abra o aplicativo.");
                    Feature(g,261,1,"02  Abra o painel","Janela › Extensões (Legado) › LightRef");
                    Feature(g,309,2,"03  Comece a criar","Materiais, luzes e cenas em um só lugar.");
                } else if(state=="error") {
                    Design.Write(g,"Detalhes do problema",294,216,430,28,10,Design.Text,true);
                    using(var font=new Font("Segoe UI",12f,FontStyle.Regular,GraphicsUnit.Pixel))using(var brush=new SolidBrush(Design.Dim))
                        g.DrawString(failure,font,brush,new RectangleF(294,253,438,83));
                } else {
                    Feature(g,213,0,"Iluminação e materiais 3D","Explore luzes, cristais e acabamento artístico.");
                    Feature(g,261,1,"Seu acervo continua com você","Cenas, modelos e preferências preservados.");
                    Feature(g,309,2,"Tudo incluído","Instalação sem downloads adicionais.");
                }
            }
            Color statusColor=state=="success" ? Design.Success : state=="error" ? Color.FromArgb(239,68,68) : Design.Dim;
            Design.Write(g,status,294,365,391,23,8.5f,statusColor,false);
            Design.Write(g,progress+"%",693,365,42,23,8.5f,statusColor,true);
            Design.Box(g,new RectangleF(294,394,440,4),Design.Border,Color.Empty,2);
            if(progress>0)Design.Box(g,new RectangleF(294,394,Math.Max(4,440*progress/100f),4),state=="success" ? Design.Success : Design.Accent,Color.Empty,2);
            using(var p=new Pen(Design.Border))g.DrawLine(p,24,436,756,436);
            Design.Write(g,"Backup automático da versão anterior",174,460,250,36,8,Design.Dim,false);
            if(logo!=null)g.DrawImage(logo,new RectangleF(25,510,73,25));
            Design.Write(g,"Ferramentas para artistas",111,510,260,25,8,Design.Dim,false);
            Design.Write(g,"XUIMART  /  LIGHTREF",599,510,157,25,7.5f,Design.Dim,false);
        }
        void Feature(Graphics g,int y,int icon,string title,string description)
        {
            Design.Box(g,new RectangleF(294,y+1,32,32),Design.Panel,Color.Empty,8);
            using(var pen=new Pen(state=="success" ? Design.Success : Design.Accent,1.4f)) {
                if(icon==0) {g.DrawEllipse(pen,304,y+8,12,12);g.DrawLine(pen,307,y+23,313,y+23);g.DrawLine(pen,310,y+4,310,y+1);g.DrawLine(pen,300,y+15,297,y+15);g.DrawLine(pen,320,y+15,323,y+15);}
                if(icon==1) {g.DrawRectangle(pen,302,y+10,16,13);g.DrawLine(pen,302,y+10,308,y+10);g.DrawLine(pen,302,y+10,302,y+7);g.DrawLine(pen,302,y+7,308,y+7);g.DrawLine(pen,308,y+7,311,y+10);}
                if(icon==2) {g.DrawRectangle(pen,303,y+8,14,17);Design.Check(g,305,y+12,pen.Color);}
            }
            Design.Write(g,title,340,y-2,394,23,9.5f,Design.Text,true);
            Design.Write(g,description,340,y+20,394,20,8.5f,Design.Dim,false);
        }
        void DrawLight(Graphics g)
        {
            using(var pen=new Pen(Color.FromArgb(62,48,64),1)) {
                g.DrawEllipse(pen,656,21,74,74);g.DrawEllipse(pen,671,21,44,74);g.DrawEllipse(pen,656,42,74,30);
                g.DrawLine(pen,693,21,693,95);g.DrawLine(pen,656,58,730,58);
            }
            using(var pen=new Pen(Design.Accent,1.5f)) {g.DrawArc(pen,656,21,74,74,205,80);g.DrawLine(pen,724,33,744,18);}
            using(var brush=new SolidBrush(Design.Accent))g.FillEllipse(brush,739,13,9,9);
        }
        void Log(string message)
        {
            if(InvokeRequired) {Invoke(new Action<string>(Log),message);return;}
            log.Items.Add(message);
            log.HorizontalExtent=Math.Max(log.HorizontalExtent,TextRenderer.MeasureText(message,log.Font).Width+8);
            log.TopIndex=Math.Max(0,log.Items.Count-1);
        }
        void SetStatus(string message,int value)
        {
            if(InvokeRequired) {Invoke(new Action<string,int>(SetStatus),message,value);return;}
            status=message;progress=Math.Max(0,Math.Min(100,value));Invalidate();
        }
        void RunInstall()
        {
            try {
                SetStatus("Verificando arquivos…",3);
                var context=InstallContext.Production(); context.CepRoots=Core.CepRoots(photoshop);context.Log=Log;
                Core.Install(context,(n,message)=>SetStatus(message,n));
                Log("Instalação concluída. Reinicie o Photoshop e abra Janela > Extensões (Legado) > LightRef.");
                Invoke(new Action(()=>Finish(true,"")));
            } catch(Exception error) {
                Log("ERRO: "+error.Message);Invoke(new Action(()=>Finish(false,error.Message)));
            }
        }
        void Finish(bool ok,string error)
        {
            busy=false;completed=ok;state=ok ? "success" : "error";failure=error;
            status=ok ? "Instalação concluída" : "Instalação interrompida";progress=ok ? 100 : 0;
            installBtn.Text=ok ? "Concluir" : "Tentar novamente";
            installBtn.Enabled=true;closeBtn.Enabled=true;closeBtn.Text="Fechar";browseBtn.Enabled=!ok;
            if(ok)hints.SetToolTip(installBtn,"Fecha o instalador. Reinicie o Photoshop e abra o painel LightRef.");
            Invalidate();
        }
        // Read-only snapshots: no install or registry writes are triggered here.
        public void Preview(string preview)
        {
            if(preview=="installing") {
                state="installing";status="Instalando nas versões do Photoshop…";progress=62;
                installBtn.Text="Instalando…";installBtn.Enabled=false;closeBtn.Enabled=false;browseBtn.Enabled=false;
            }
            if(preview=="success")Finish(true,"");
            if(preview=="error")Finish(false,"Não foi possível atualizar uma pasta do Photoshop. Confira as permissões e tente novamente.");
            if(preview=="details") {details=true;log.Visible=true;detailsBtn.Text="Ocultar detalhes";}
            Invalidate();
        }
        protected override void Dispose(bool disposing)
        {
            if(disposing) {if(logo!=null)logo.Dispose();hints.Dispose();}
            base.Dispose(disposing);
        }
    }
}
