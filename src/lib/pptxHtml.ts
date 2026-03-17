function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

export function buildPptxSlideSrcDoc(slideHtml: string): string {
  const safeSlideHtml = stripScripts(slideHtml);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      #stage {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      #host {
        position: absolute;
        left: 50%;
        top: 50%;
        transform-origin: top left;
      }
    </style>
  </head>
  <body>
    <div id="stage">
      <div id="host">${safeSlideHtml}</div>
    </div>
    <script>
      (function () {
        var host = document.getElementById("host");
        var fallbackWidth = 960;
        var fallbackHeight = 540;

        function getSize(target) {
          if (!target) return { width: fallbackWidth, height: fallbackHeight };
          var style = target.style || {};
          var width = parseFloat(style.width || "");
          var height = parseFloat(style.height || "");
          if (!(width > 0) || !(height > 0)) {
            var rect = target.getBoundingClientRect();
            width = width > 0 ? width : rect.width;
            height = height > 0 ? height : rect.height;
          }
          if (!(width > 0)) width = fallbackWidth;
          if (!(height > 0)) height = fallbackHeight;
          return { width: width, height: height };
        }

        function fit() {
          if (!host) return;
          var target = host.firstElementChild || host;
          var size = getSize(target);
          var vw = window.innerWidth || fallbackWidth;
          var vh = window.innerHeight || fallbackHeight;
          var scale = Math.min(vw / size.width, vh / size.height);
          if (!(scale > 0) || !isFinite(scale)) scale = 1;
          host.style.width = size.width + "px";
          host.style.height = size.height + "px";
          host.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
        }

        window.addEventListener("resize", fit);
        setTimeout(fit, 0);
        setTimeout(fit, 80);
        setTimeout(fit, 250);
      })();
    </script>
  </body>
</html>`;
}

