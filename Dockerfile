# ---- Fase de runtime ----
# Imagen ligera para servir el build Angular con Nginx en OpenShift.

FROM registry.access.redhat.com/ubi9/nginx-124:9.5-1747041256

ADD nginx.conf ${NGINX_CONF_PATH}
ADD dist/tfm-iaap-frontend-administracion/browser /usr/share/nginx/html/

EXPOSE 8043

CMD ["nginx", "-g", "daemon off;"]
