package id.jagawarga.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider
import id.jagawarga.app.MainActivity
import id.jagawarga.app.R
import java.text.NumberFormat
import java.util.Locale

/**
 * Widget hanya menampilkan snapshot yang ditulis Flutter (`WidgetService`).
 * Tap selalu membuka aplikasi — tidak pernah mengirim panic dari RemoteViews.
 */
private fun launch(context: Context, uri: String): PendingIntent =
    HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, Uri.parse(uri))

private fun formatRupiah(raw: String?): String {
    val value = raw?.toLongOrNull() ?: 0L
    return NumberFormat.getCurrencyInstance(Locale("id", "ID"))
        .format(value)
        .replace("\u00a0", " ")
        .replace(",00", "")
}

class PanicWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        val status = widgetData.getString("widget_status", "unauthenticated") ?: "unauthenticated"
        val house = widgetData.getString("widget_house", "") ?: ""
        val alertHouse = widgetData.getString("widget_alert_house", "") ?: ""
        val updated = widgetData.getString("widget_updated", "") ?: ""

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_panic)

            when (status) {
                "alert" -> {
                    views.setTextViewText(
                        R.id.widget_panic_status,
                        "DARURAT — ${alertHouse.ifEmpty { house }}",
                    )
                    views.setInt(R.id.widget_panic_root, "setBackgroundResource", R.drawable.widget_bg_alert)
                }
                "safe" -> {
                    views.setTextViewText(R.id.widget_panic_status, "Aman")
                    views.setInt(R.id.widget_panic_root, "setBackgroundResource", R.drawable.widget_bg)
                }
                else -> {
                    views.setTextViewText(R.id.widget_panic_status, "Masuk untuk mengaktifkan")
                    views.setInt(R.id.widget_panic_root, "setBackgroundResource", R.drawable.widget_bg)
                }
            }

            views.setTextViewText(R.id.widget_panic_house, house)
            views.setTextViewText(
                R.id.widget_panic_updated,
                if (updated.isEmpty()) "" else "diperbarui $updated",
            )
            views.setOnClickPendingIntent(
                R.id.widget_panic_button,
                launch(context, "jagawarga:///panic/confirm?type=panic"),
            )
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

class BantuanWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        val status = widgetData.getString("widget_status", "unauthenticated") ?: "unauthenticated"
        val count = widgetData.getString("widget_unpaid_count", "0")?.toIntOrNull() ?: 0
        val total = widgetData.getString("widget_unpaid_total", "0") ?: "0"
        val updated = widgetData.getString("widget_updated", "") ?: ""

        val unpaidLabel = when {
            status != "safe" && status != "alert" -> "Masuk untuk mengaktifkan"
            count > 0 -> "$count tagihan · ${formatRupiah(total)}"
            else -> "Tidak ada tagihan"
        }

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_bantuan)
            views.setInt(
                R.id.widget_bantuan_root,
                "setBackgroundResource",
                if (status == "alert") R.drawable.widget_bg_alert else R.drawable.widget_bg,
            )
            views.setTextViewText(R.id.widget_bantuan_unpaid, unpaidLabel)
            views.setTextViewText(R.id.widget_bantuan_updated, if (updated.isEmpty()) "" else updated)

            val buttons = mapOf(
                R.id.widget_bantuan_panic to "panic",
                R.id.widget_bantuan_maling to "security",
                R.id.widget_bantuan_kebakaran to "fire",
                R.id.widget_bantuan_medis to "medical",
            )
            buttons.forEach { (viewId, type) ->
                views.setOnClickPendingIntent(
                    viewId,
                    launch(context, "jagawarga:///panic/confirm?type=$type"),
                )
            }

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}

class InfoWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        val status = widgetData.getString("widget_status", "unauthenticated") ?: "unauthenticated"
        val announcement = widgetData.getString("widget_announcement", "") ?: ""
        val count = widgetData.getString("widget_unpaid_count", "0")?.toIntOrNull() ?: 0
        val total = widgetData.getString("widget_unpaid_total", "0") ?: "0"

        val title = when {
            status != "safe" && status != "alert" -> "Masuk untuk mengaktifkan"
            announcement.isNotEmpty() -> announcement
            else -> "Belum ada pengumuman"
        }
        val subtitle = when {
            status != "safe" && status != "alert" -> ""
            count > 0 -> "$count tagihan · ${formatRupiah(total)}"
            else -> "Kas & pengumuman warga"
        }

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_info)
            views.setTextViewText(R.id.widget_info_title, title)
            views.setTextViewText(R.id.widget_info_subtitle, subtitle)
            views.setOnClickPendingIntent(
                R.id.widget_info_root,
                launch(context, "jagawarga:///open"),
            )
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
