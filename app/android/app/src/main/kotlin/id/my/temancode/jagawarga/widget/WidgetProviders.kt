package id.my.temancode.jagawarga.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider
import id.my.temancode.jagawarga.MainActivity
import id.my.temancode.jagawarga.R
import java.text.NumberFormat
import java.util.Locale

/**
 * Widget hanya menampilkan snapshot yang ditulis Flutter (`WidgetService`).
 * Tap selalu membuka aplikasi — tidak pernah mengirim panic dari RemoteViews.
 */
/**
 * Setiap aksi memakai requestCode unik: beberapa launcher menganggap
 * PendingIntent dengan requestCode sama sebagai satu intent yang sama.
 */
private fun launch(context: Context, uri: String, code: Int): PendingIntent {
    val intent = Intent(context, MainActivity::class.java).apply {
        action = HomeWidgetLaunchIntent.HOME_WIDGET_LAUNCH_ACTION
        data = Uri.parse(uri)
    }
    return PendingIntent.getActivity(
        context,
        code,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}

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

        Log.d("JagaWidget", "panic update status=$status widgets=${appWidgetIds.size}")

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
            val openConfirm = launch(context, "jagawarga:///panic/confirm?type=panic", 1)
            views.setOnClickPendingIntent(R.id.widget_panic_button, openConfirm)
            // Seluruh kartu juga bisa diketuk (area kecil sulit di HP).
            views.setOnClickPendingIntent(R.id.widget_panic_root, openConfirm)
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

        Log.d("JagaWidget", "bantuan update status=$status widgets=${appWidgetIds.size}")

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
            buttons.entries.forEachIndexed { index, (viewId, type) ->
                views.setOnClickPendingIntent(
                    viewId,
                    launch(context, "jagawarga:///panic/confirm?type=$type", 10 + index),
                )
            }
            views.setOnClickPendingIntent(
                R.id.widget_bantuan_root,
                launch(context, "jagawarga:///open", 20),
            )

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

        Log.d("JagaWidget", "info update status=$status widgets=${appWidgetIds.size}")

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.widget_info)
            views.setTextViewText(R.id.widget_info_title, title)
            views.setTextViewText(R.id.widget_info_subtitle, subtitle)
            views.setOnClickPendingIntent(
                R.id.widget_info_root,
                launch(context, "jagawarga:///open", 30),
            )
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
