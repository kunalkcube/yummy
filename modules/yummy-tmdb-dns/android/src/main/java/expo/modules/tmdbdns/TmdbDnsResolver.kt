package expo.modules.tmdbdns

import java.net.InetAddress
import java.net.Inet6Address
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.FutureTask
import okhttp3.Dns

internal class TmdbDnsResolver(
  private val isEnabled: () -> Boolean,
  private val cloudflareDns: Dns,
  private val systemDns: Dns = Dns.SYSTEM,
) : Dns {
  private val inFlight = ConcurrentHashMap<String, FutureTask<List<InetAddress>>>()

  override fun lookup(hostname: String): List<InetAddress> {
    if (!isEnabled() || hostname !in TMDB_HOSTS) return systemDns.lookup(hostname)

    // Home starts several requests together; share DNS work without caching past its TTL.
    val task = FutureTask { resolveTmdb(hostname) }
    val pending = inFlight.putIfAbsent(hostname, task) ?: task.also { it.run() }
    return try {
      pending.get()
    } catch (error: ExecutionException) {
      throw error.cause as? UnknownHostException
        ?: UnknownHostException("Could not resolve $hostname").apply { initCause(error.cause) }
    } catch (error: InterruptedException) {
      Thread.currentThread().interrupt()
      throw UnknownHostException("DNS lookup interrupted").apply { initCause(error) }
    } finally {
      if (pending === task) inFlight.remove(hostname, task)
    }
  }

  private fun resolveTmdb(hostname: String): List<InetAddress> {
    return try {
      cloudflareDns.lookup(hostname).ifEmpty {
        throw UnknownHostException("No Cloudflare DNS results for $hostname")
      // OkHttp 4 tries addresses sequentially; prefer IPv4 but retain IPv6-only compatibility.
      }.sortedBy { it is Inet6Address }
    } catch (error: UnknownHostException) {
      try {
        systemDns.lookup(hostname)
      } catch (fallbackError: UnknownHostException) {
        fallbackError.addSuppressed(error)
        throw fallbackError
      }
    }
  }

  private companion object {
    val TMDB_HOSTS = setOf("api.themoviedb.org", "image.tmdb.org")
  }
}
