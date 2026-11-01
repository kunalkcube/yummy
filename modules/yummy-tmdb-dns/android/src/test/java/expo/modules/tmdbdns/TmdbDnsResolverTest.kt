package expo.modules.tmdbdns

import java.net.InetAddress
import java.net.UnknownHostException
import okhttp3.Dns
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class TmdbDnsResolverTest {
  private val cloudflareAddress = listOf(InetAddress.getByAddress(byteArrayOf(1, 2, 3, 4)))
  private val deviceAddress = listOf(InetAddress.getByAddress(byteArrayOf(5, 6, 7, 8)))

  private fun dns(resolve: (String) -> List<InetAddress>) = object : Dns {
    override fun lookup(hostname: String) = resolve(hostname)
  }

  @Test
  fun disabledUsesDeviceDnsWithoutContactingCloudflare() {
    val resolver = TmdbDnsResolver({ false }, dns { error("Must not query Cloudflare") }, dns { deviceAddress })
    assertEquals(deviceAddress, resolver.lookup("api.themoviedb.org"))
    assertEquals(deviceAddress, resolver.lookup("image.tmdb.org"))
  }

  @Test
  fun enabledResolvesApiAndImagesWithoutUsingDeviceDns() {
    val resolver = TmdbDnsResolver({ true }, dns { cloudflareAddress }, dns { error("Device DNS is blocked") })
    assertEquals(cloudflareAddress, resolver.lookup("api.themoviedb.org"))
    assertEquals(cloudflareAddress, resolver.lookup("image.tmdb.org"))
  }

  @Test
  fun otherHostsNeverUseCloudflare() {
    val resolver = TmdbDnsResolver({ true }, dns { error("Must not query Cloudflare") }, dns { deviceAddress })
    for (host in listOf("example.com", "api.themoviedb.org.example.com", "themoviedb.org", "iptv-org.github.io")) {
      assertEquals(deviceAddress, resolver.lookup(host))
    }
  }

  @Test
  fun unavailableCloudflareFallsBackToDeviceDns() {
    val resolver = TmdbDnsResolver({ true }, dns { throw UnknownHostException("Resolver unavailable") }, dns { deviceAddress })
    assertEquals(deviceAddress, resolver.lookup("api.themoviedb.org"))
  }

  @Test
  fun emptyCloudflareResultFallsBackToDeviceDns() {
    val resolver = TmdbDnsResolver({ true }, dns { emptyList() }, dns { deviceAddress })
    assertEquals(deviceAddress, resolver.lookup("image.tmdb.org"))
  }

  @Test
  fun bothResolversFailWithoutInventingAnAddress() {
    val resolver = TmdbDnsResolver({ true }, dns { throw UnknownHostException("Cloudflare failed") }, dns { throw UnknownHostException("Device DNS failed") })
    val error = assertThrows(UnknownHostException::class.java) { resolver.lookup("api.themoviedb.org") }
    assertEquals("Device DNS failed", error.message)
    assertEquals("Cloudflare failed", error.suppressed.single().message)
  }

  @Test
  fun changesTakeEffectOnExistingResolver() {
    var enabled = false
    val resolver = TmdbDnsResolver({ enabled }, dns { cloudflareAddress }, dns { deviceAddress })
    assertEquals(deviceAddress, resolver.lookup("api.themoviedb.org"))
    enabled = true
    assertEquals(cloudflareAddress, resolver.lookup("api.themoviedb.org"))
    enabled = false
    assertEquals(deviceAddress, resolver.lookup("image.tmdb.org"))
  }

  @Test
  fun prefersIpv4WithoutDroppingIpv6() {
    val ipv6 = InetAddress.getByName("2001:db8::1")
    val ipv4 = cloudflareAddress.single()
    val resolver = TmdbDnsResolver({ true }, dns { listOf(ipv6, ipv4) })
    assertEquals(listOf(ipv4, ipv6), resolver.lookup("api.themoviedb.org"))
    val ipv6Only = TmdbDnsResolver({ true }, dns { listOf(ipv6) })
    assertEquals(listOf(ipv6), ipv6Only.lookup("image.tmdb.org"))
  }

  @Test
  fun concurrentRequestsShareOneLookupWithoutKeepingStaleAddresses() {
    val queries = AtomicInteger()
    val release = CountDownLatch(1)
    val results = Collections.synchronizedList(mutableListOf<List<InetAddress>>())
    val resolver = TmdbDnsResolver({ true }, dns {
      queries.incrementAndGet()
      check(release.await(5, TimeUnit.SECONDS))
      cloudflareAddress
    })
    val callers = List(5) { Thread { results.add(resolver.lookup("api.themoviedb.org")) } }
    try {
      callers.forEach { it.start() }
      val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3)
      while (callers.any { it.state != Thread.State.WAITING && it.state != Thread.State.TIMED_WAITING } && System.nanoTime() < deadline) {
        Thread.sleep(1)
      }
      assertTrue(callers.all { it.state == Thread.State.WAITING || it.state == Thread.State.TIMED_WAITING })
      assertEquals(1, queries.get())
    } finally {
      release.countDown()
      callers.forEach { it.join(5_000) }
    }
    assertEquals(List(5) { cloudflareAddress }, results)
    assertEquals(cloudflareAddress, resolver.lookup("api.themoviedb.org"))
    assertEquals(2, queries.get())
  }
}
