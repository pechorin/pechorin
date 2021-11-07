---
title: Стэк JSON логирования в Ruby | Rails приложениях — мой боевой набор
date: 2021-09-03
created_at: 2021-09-03 02:55 +03:00
tags: [ruby, elasticsearch, indexing]
taxonomy:
  category:
    - research & development
  post_tags:
    - ruby
    - elasticsearch
    - toolset
    - преодоление и боль
---
В начале пути программиста логи являются двадцать пятым делом. Затем когда наступает продакшен[^1] логи становятся более важной частью реальности, а отсуствие их (логов) в этой самой реальности могут приносить реальную боль вам.

Давайте я не буду преуменьшать происходящее и выскажу, что логи это важнейшая часть интроспекции программы, а во многих случаях логи еще и единственный инструмент изучать и следить за происходящим.

Готовые логгинг конфигурации не всегда дают полнейшее решение с точки зрения "мы настроили максимально красиво". Хочется доработать[^2]. При этом нельзя один раз сделать и забыть, подключать контекстные данные к логам событий требуется на протяжении всей жизни ПО.

Поэтому хорошим практики логирования и интоспекции ПО нужно на ровне с каким-нибудь юнит-тестированием обучать с самого начала карьеры — не надо будет доучивать и переучивать потом[^3] (даже не смотря на то что юнит-тестирование противоречит print-debug тестированию, которое реализуется через логирование на экран).

С моральными ценностями и установкам разобрались, двинемся дальше, и для начала обрисуем проблематику и объектную область:

1. `Приложение` — наше приложение, которое порождает события, которые мы и будем логировать. Требует настройки и переодической поддержки стэка логирования при росте функциональности.
2. `Логи` — логи из абстрактных объектов превращаются в физические попадая на диск, требуют хранения/ротации и доставки в хранилище.
3. `Интроспекция` — те инструменты, что помогают нам в анализе логов, и обычно они читают данные с диска хранилища, но вот незадача — мы не можем хранить данные вечно.

По факту  отталкиваемся мы во многом мы от инструментов инстроспекции. Скажем так, использования elasticsearch привело меня к нужде в конвертации plain text логов в json формате, а не наоборот. Помимо прочего elasticsearch можно заменить, а json логи подойдут во многие "другие места".

Давай определимся с одной фундаментальной вещью — **Приложения пишут логи в STDOUT**.

_Для kubernetes и других docker-like окружений это является стандартной практикой. STDOUT у контейнера один, а файлов куда приложения пишут логи - может быть много, так что мы центрилизируем вывод логов таким образом (и его легче собрать и обработать)._

И так, для начала взглянем на то что мы получим в итоге и за пример возьмем лог события веб сервера и разберем важные моменты:

## Разбор примера: json-лог события веб-сервера

```json
{
  "app":"MyApplication",
  "method":"GET",
  "path":"/api/search",
  "format":"json",
  "controller":"SearchController",
  "action":"index",
  "status":200,
  "duration":81.8,
  "view":4.98,
  "db":31.42,
  "params":{
    "hotel":"true",
    "page":"2",
    "controller":"search",
    "action":"index"
  },
  "remote_ip":null,
  "event_name":"process_action.action_controller",
  "@timestamp":"2020-11-24T21:30:31.147+03:00",
  "message":"[200] GET /api/search (SearchController#index)",
  "severity":"INFO",
  "host":"scarif-api-5867fd896d-dktcg",
  "tags":[
     "986c139b5de9188d92df3dc00e58e0b4"
  ],
  "env":"development",
  "kind":"web"
}
```

Просмотрев этот пример, давайте выделем самые важные поля:

#### Идентификатор приложения

```text {.oneline}
"app":"MyApplication"`
```

Не всегда обязательно,  но если логи с разных приложений попадут в единый "стрим", то это поможет в фильтрации и поиске.

#### Тип приложения
```text {.oneline}
"kind":"web"
```
Ключ kind определеяет тип приложения — веб сервер, воркер, api и так далее.
Тут под "web" подоразумыевается "http web сервер".

#### Тип события
```text {.oneline}
"event_name":"process_action.action_controller"
```

Имея это поле в каждом логи мы смолжем фильтровать и вести статистику по конкретным группам событий в нашем приложении. К примеру мы сможем только исходя из логов отвечать на вопросы:

- Сколько http событий было?
- Сколько успешных? А Сколько со статус 401?
- Сколько было бизнес-событий?
- А сколько не-успешных бизнес событий? (сколько раз совершена покупка и так далее)
- и даже: сколько раз отработал воркер N.

#### Контекстные данные
```text {.oneline}
"params":{
  "hotel":"true",
  "page":"2",
  "controller":"search",
  "action":"index"
},
```

В интеграциях с другими плагинами мы будем передавать другие контекстные данные. В данном примере контекстом являются параметры http контроллера.

## Интерфейс отправки & выбор логгера
Стандартный интерфейс Rails-логгера выглядит так:

```ruby
Rails.logger.info("Hello Developers!")
```

Не очень хочется уходить от стандарта, и тем более не хочется ломать старую кодовую базу. Благо почти все популярные логгеры похожи в плане интерфейса взаимодействия. Проблемы для меня возникли в следующем:

- Не все библиотеки позволяют создать несколько инсантов логгера
- Не все библиотеки позволяют продублировать поток вывод в дополнительный источник (то есть: сразу писать и в STDOUT и в отдельный файл).

Из-за этих моих хотелок я сразу выкинул https://github.com/reidmorrison/semantic_logger. Он прекрасен, но он намертво привязан к одному глобальному инстантсу и нет возможность писать сразу в два источника.  Хотя этот логгер удалось использовать в одном проекте на протяжении долгого времени. Если вам не беспокоят вещи о которых я пишу — можете пробовать и его.

После часов копаний и изучений всех возможных вариантов мой выбор пал на [lagstash-logger](https://github.com/dwbutler/logstash-logger) (хотя я максимально пытался найти другое решение, но в итоге - очаров этим логгером).

### Берем доп. Гемы на борт
Так же для предподготовки rails логов нам пригодится [lograge](https://github.com/roidrage/lograge) — эта штука привращает 10-строчные лог событий Rails в однострочный лог. Критически важно :)

А с помощью же [httplog](https://github.com/trusche/httplog) мы пробросим наш логгер во все http вызовы, и получим море новый debug-информации. (так как создаваемые http события не так уж и часто логириются в веб-проектах).

## Установка и настройка решения

#### Gemfile
```ruby
gem 'lograge'
gem 'logstash-logger'
gem 'httplog'
```

#### config/initializers/logstash_logger.rb
Это стартовая точка нашей конфигурации.
Для начала настроим поля, которые будут присутствовать в каждом логе:
```ruby
LogStashLogger.configure do |config|
  config.customize_event do |event|
    event[:app]    = "MyApplication"
    event[:env]    = Rails.env
    event[:kind] ||= "web"
  end
end
```

При этом поле `:kind` будет переопределено другими процессами нашего сервиса (например воркеры будут иметь `event[:kind] == "workers"`.

#### Настройка типов вывода логирования в разных окружениях
Представленная конфигурация может быть изменена под свои нужды.

С учетом иерархии конфигурации, абстрактно, наш логер будет настроен так:

config/application.rb - настройка по-умолчанию, если не определено в следующих файлах
- пишет в stdout с обычныс форматирования
- пишет в лог-файл в json формате

config/production.rb
- пишет в stdout в формате json
- пишет в лог-файл в формате json

config/development.rb
- использует настройку config/application.rb
- если передана переменная окружения `JSON_LOGGER`, то будет логировать в stdout json логи (а не обычные, как определено в config/application.rb) — это полезно только для дебага json логов, чтобы увидеть как будут выглядить ваши json логи в stdout'е запущенного веб-сервера в development окружении.

config/test.rb
- не логирует логи в stdout
- пишет в лог-файл в формате json

Перейдем к найтроке:

#### config/application.rb
Далее я буду комментаровать прямо внутри исходного кода чаще (пока не нашел красивых решений этой задачи).

```ruby
# Настраваем lograge по канонам их readme

config.lograge.enabled = true
config.lograge.base_controller_class = "ActionController::API"

# Лично для себя пока не нашел большой пользы от этой настройки, но тем неменее, помечаем каждый лог action controller'а уникальным идентификатором (если я верно понял суть)

config.log_tags = [:request_id]

# Пробрасываем кастомные настройки в логи action controller'а через настройки lograge

config.lograge.custom_options = lambda do |event|
  kv = {
    event_name: event.name,              # тип события
    params: event.payload[:params],      # параметры события
    remote_ip: event.payload[:remote_ip] # удаленный ip
  }

  # Раскрываем backtrace исключения, если информация о нем предоставлена в событии
  if event.payload[:exception]
    kv[:exception]  = event.payload[:exception]
    kv[:stacktrace] = event.payload[:exception_object].backtrace.first(10)
  end

  kv
end

# Пробрасываем информацию из контроллеров и lograge

config.lograge.custom_payload do |controller|
  kv = {}

  # Вы можете добавить что-то еще помимо текущего email'а пользователя
  if controller.respond_to?(:current_user) and (user = controller.current_user)
    kv[:admin_email] = user.email
  end

  kv
end

# Настройка логирования по-умолчанию

logger = LogStashLogger.new({
  type: :multi_logger,
  outputs: [
    {
      type: :stdout,
      formatter: ::Logger::Formatter,
    },
    {
      type: :file,
      formatter: :json_lines,
      path: Rails.root.join("log/#{Rails.env}.log"),
      sync: true,
    }
  ]
})

config.logger            = logger
config.colorize_logging  = true
```

Собственно возможность направлять логи сразу в несколько мест — основная киллер-фича LogStashLogger'ера. Нам пригодится это не только для перенаправления сразу в STDOUT и лог-файл, но и для перенаправления логов определнных событий в соверешнной другой, отличный от стандартного файл (будем писать логи медленных событий в отдельный файл, но об этом чуть ниже).

#### config/environments/production.rb
```ruby
logger = LogStashLogger.new({
  type: :multi_logger,
  outputs: [
    {
      type: :stdout,
      formatter: :json_lines,
    },
    {
      type: :file,
      formatter: :json_lines,
      path: Rails.root.join("log/#{Rails.env}.log"),
      sync: true,
    }
  ]
})

config.logger            = logger
config.colorize_logging  = false
config.lograge.formatter = Lograge::Formatters::Logstash.new # Важно не забыть настройку
                                                             # форматирования lograge'а
```

#### config/environments/development.rb
```ruby
# Полезно для дебага, чтобы увидеть как json логи выглядит в development'е.
if ENV['JSON_LOGGER']
  logger = LogStashLogger.new({
    type: :multi_logger,
    outputs: [
      {
        type: :stdout,
        formatter: :json_lines,
      },
      {
        type: :file,
        formatter: :json_lines,
        path: Rails.root.join("log/#{Rails.env}.log"),
        sync: true,
      }
    ]
  })

  config.logger            = logger
  config.colorize_logging  = false
  config.lograge.formatter = Lograge::Formatters::Logstash.new
end
```

#### config/environments/test.rb
```ruby
logger = LogStashLogger.new({
  type: :multi_logger,
  outputs: [
    {
      type: :file,
      formatter: ::Logger::Formatter,
      path: Rails.root.join("log/#{Rails.env}.log"),
      sync: true,
    }
  ]
})

config.log_level        = :debug
config.logger           = logger
config.colorize_logging = true
```

#### Настройка логирования исходящих http запросов
Чтобы подруждить httplog и logstah-logger пришлось небольшой патч, помимо самой интгеграции, зато теперь все исходящие http-запросы красиво логируются в нашей (или вашей) системе:

##### config/initializers/http_log.rb
```ruby
class HttpLogFormatter

  class << self

    def call(kv = {})
      hash = {
        event_name: :http_request,
        message: "#{kv[:response_code]} #{kv[:method]} #{kv[:url].to_s}",
        duration: kv[:benchmark],
        context: {},
      }

      if Rails.env.production?
        # log only failed requsts in production
        if kv[:response_code] != 200
          hash[:context][:response_body] = kv[:response_body]
        end
      else
        hash[:context][:response_body] = kv[:response_body]
      end

      return hash
    end

  end

end

HttpLog.configure do |config|
  config.prefix            = ''
  config.enabled           = true
  config.logger            = Rails.logger
  config.json_parser       = JSON
  config.graylog_formatter = HttpLogFormatter
  config.filter_parameters = []
end

# Пришлось написать небольшой патч:

# FIXME: logstash multi logger not working with :add method properly (only with info/debug etc)
module HttpLog

  class << self
    def send_to_graylog data
      data.compact!

      config.logger.info(config.graylog_formatter.call(data))
    end
  end

end
```

#### config/initializers/sidekiq.rb - настройка sidekiq
Эта часть конфигурации не самая полная, и требует дальнешей доработке в контексте обогащения данными. Но, уже что-то ;)

```ruby
creds = (Settings.redis&.to_hash || {}).merge(namespace: 'myapp')

class MyApplicationSidekiqFormatter

  def self.call(event)
    event[:kind] = 'sidekiq'
    event[:pid]  = Process.pid
    event[:tid]  = "TID-#{Thread.current.object_id.to_s(36)}"

    Thread.current[:sidekiq_context]&.each do |k, v|
      case k
      when :elapsed
        event[:duration] = v
      when :class
        event[:job_name] = v
      else
        event[k] = v
      end
    end
  end

end


Sidekiq.configure_server do |config|
  logger = LogStashLogger.new({
    type: :multi_logger,
    outputs: [
      {
        type: :stdout,
        formatter: :json_lines,
        customize_event: ->(event) { MyApplicationFormatter.call(event) }
      },
      {
        type: :file,
        formatter: :json_lines,
        path: Rails.root.join("log/sidekiq.log"),
        sync: true,
        customize_event: ->(event) { MyApplicationFormatter.call(event) }
      },
    ]
  })

  config.redis  = creds
  config.logger = logger
end

Sidekiq.configure_client do |config|
  config.redis  = creds
  config.logger = Rails.logger
end
```

## Бонус: логируем медленные http запросы (в том числе в отдельный лог-файл)
Мы будем логировать долгие sql запросы при помощи подписки на события `ActiveSupport::Notifications`. Таким образом, взяв этот пример, вы можете создать свои логеры на другие события этого rails модуля.

#### lib/slow_query_logger.rb:
```ruby
require "json"
require "digest"
require "logger"

class SlowQueryLogger

  TX_TAGS     = /BEGIN|COMMIT/
  MODIFY_TAGS = /INSERT|UPDATE|DELETE/
  READ_LABEL  = "read"
  WRITE_LABEL = "write"
  EVENT_NAME  = "sql.slow_query"

  EMPTY_LINE_FILTER = /(^([\s]+)?$\n)/

  def initialize(logger, opts = {})
    @threshold = opts.fetch(:threshold, 350).to_i
    @level     = opts.fetch(:level, :warn).to_sym
    @logger    = logger
  end

  def call(name, start, finish, id, payload)
    return if TX_TAGS.match?(payload[:sql])

    duration = ((finish - start) * 1000).round(4)
    return unless duration >= @threshold

    query = payload[:sql].strip.gsub(EMPTY_LINE_FILTER, '')

    data = {
      duration:   duration,
      query:      query,
      query_kind: MODIFY_TAGS.match?(payload[:sql]) ? WRITE_LABEL : READ_LABEL,
      length:     payload[:sql].size,
      cached:     payload[:cache] ? true : false,
      hash:       Digest::SHA1.hexdigest(payload[:sql]),
      class_name: self.class.na**me,
      event_name: EVENT_NAME,
    }.compact

    @logger.send(@level, data)
  end

end
```

#### config/initializers/slow_query_logger.rb:
Подписываем наш логгер на стрим событий.
При этом мы будем логировать событие сразу в два физических файл - в основной лог приложения, и отдельный лог-файл, созданный специально для трейсинга не оптимальностей и тормозов в мире sql'я :)
```ruby
require "slow_query_logger"

threshold = ENV["RAILS_LOG_SLOW_QUERIES_THRESHOLD"] || 350 # ms

base_file_logger = Logger.new(Rails.root.join("log/slow_queries.log"))

rails_query_logger = SlowQueryLogger.new(Rails.logger, threshold: threshold)
file_query_logger  = SlowQueryLogger.new(base_file_logger, threshold: threshold)

ActiveSupport::Notifications.subscribe("sql.active_record") do |name, start, finish, id, payload|
  rails_query_logger.call(name, start, finish, id, payload)
  file_query_logger.call(name, start, finish, id, payload)
end
```

## Сбор & анализ логов — дороговизна решений и индексации
В данный момент мы идем самым дорогим путем — платим за elasticsearch в облаке. Процессы-коллекторы собирают логи с stdout'ов наших сервисов и доставляют его в кластер elasticsearch. Далее мы смотрим и анализируем логи через [kibana](https://www.elastic.co/kibana/).

Все красиво, но дорого. Не так дорого если развернуть elastic у себя, но все еще совсем не дешево. Хочется более дешевого решения, и надеюсь скоро оно появится.

Elasticsearch прекрасен, но не всегда все его фичи нужны в задаче по сбору и анализу логов. Скажем точнее - не все физи полнотекстового поиска. К тому же elasticsearch это java, ну, это классно, но могло бы быть быстрее, если бы было написано на golang'е или rust'е.

Сейчас появляется много альтернатив эластику, но все это только зараждается, и похоже создателей часто заносит и уносит в сторону "сделать свое крутое платное". Их можно понять. Ждем убийцу эластика в том числе в этом сегменте. loki не предлагать.


[^1]: продакш(е)н [production] — это когда ваша программа из фазы "делаем дома" попадает в реальный мир и пользователи сталкиваются с несовершенством вашей человеческой натуры.
[^2]: "хочется доработать" — болезнь программистов
[^3]: справедливо относится почти ко всему, слишком генерализированное пожелание к вселенной :)
