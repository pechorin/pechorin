---
title: Стэк JSON логирования в Ruby & Rails приложениях — мой боевой набор
date: 2021-09-03
created_at: 2021-09-03 02:55 +03:00
taxonomy:
  category:
    - research & development
  post_tag:
    - ruby
    - elasticsearch
    - toolset
    - преодоление и боль
---
В начале пути программиста я как-то не особо заморачивался по логированию. Но с каждым годом жизни в продакшене логи становились для меня все более важной частью реальности, а отсутствие их (логов) в этой самой реальности могло привнести вполне реальную боль.

Не буду преуменьшать происходящее и выскажу, что логи это важнейшая часть интроспекции программы, а во многих случаях логи еще и единственная возможность изучать и следить за происходящим. (вынесем тему мониторинга за рамки этой записи)

При этом нельзя один раз сделать и забыть — описывать и логировать контекстные данные важных событий приложения требуется на протяжении всего цикла разработки и поддержки.

Обрисую проблематику и предметную область:

1. `Приложение` —  порождает события, которые мы будем логировать, не-логирование этих событий может стать болью.
2. `Логи` — абстрактные объекты превращаются в физические попадая на диск, требуют хранения и ротации, так как ресурсы хоста не бесконечны.
3. `Интроспекция` — помимо хранения нужно обеспечивать среду, где эти логи могут быть изучены и проанализированы. В простом случае хватит grep'а на хост машине, но если хостов больше, то пора задумываться о средах вроде Elasticsearch/Loki и тому подобных. (Сейчас их становится все больше, к радости)

Для kubernetes и других docker-like окружений стандартом является практика записи логов в [стандартный поток вывода](https://ru.wikipedia.org/wiki/Стандартные_потоки). Стандартный вывод stdout у контейнера один, а файлов куда приложения пишут логи может быть много, поэтому агрегация логов в stdout универсальное и красивое решение.

Красота тут правда условна, так как появляются новые задачи и проблемы — процессу который собирает логи с контейнеров приложений и доставляет их в среду анализа надо успеть собрать их до смерти контейнера. И делать это постоянно. Назовем это pull-моделью. При push-модели само приложение будет доставлять логи в хранилище и решать проблемы гарантий доставки, т.к. данные желательно не терять.

Выбор нужной модели, а также обзор решений по анализу логов находятся за рамками этой заметки, поговорим об этом позже, когда я и сам найду чем заменить Elasticsearch :)

А пока перейдем к разбору итогового лога, который мы должны получить после всех наших конфигураций и настроек в нашем Rails приложении:

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
    "page":"2",
    "controller":"search",
    "action":"index"
  },
  "remote_ip":null,
  "event_name":"process_action.action_controller",
  "@timestamp":"2020-11-24T21:30:31.147+03:00",
  "message":"[200] GET /api/search (SearchController#index)",
  "severity":"INFO",
  "host":"my-app-api-5867fd896d-dktcg",
  "tags":[
     "986c139b5de9188d92df3dc00e58e0b4"
  ],
  "env":"development",
  "kind":"web"
}
```

Разберем важные поля из этого примера:

#### Идентификатор приложения

```text
"app":"MyApplication"`
```

Если логи с разных приложений попадут в единый "стрим" на уровне среды анализа, то это поможет отфильтровывать интересующее приложение. Можно и без этого поля, решение зависит от вашей среды.

#### Тип приложения
```text
"kind":"web"
```

Ключ kind определеяет тип приложения — веб сервер, воркер, api и так далее. Тут под "web" подразумевается "http web сервер". Но вы, само собой, можете придумать свои типажи.

#### Тип события
```text
"event_name":"process_action.action_controller"
```

Имея это поле в каждом логе мы сможем не только фильтровать, но и вести статистику по конкретным группам событий нашего приложения. (и даже сделать мониторинг на основе этих данных, если среда позволяет) 

Вот только базовой список вопросов к нашим логам, которые мы сможем задать имея такую строгую категоризацию для каждого типа событий:

- Сколько http событий произошло?
- Сколько успешных? А Сколько со статус 401?
- Сколько всего произошло бизнес-событий за вчера? А за неделю?
- А сколько раз люди не смогли оплатить корзину покупок из-за проблем с балансом?
- и даже "Сколько раз отработал мой ruby воркер"?

#### Контекстные данные
```text
"params":{
  "page":"2",
  "controller":"search",
  "action":"index"
},
```

В данном примере контекстными данными являются параметры контроллера. При интеграции нашего стэка логирования с другими модулями системы мы увидим другие контекстные данные, которые сами же и будем пробрасывать/прикряплять к данным лога.

Например, вот так выглядит строка логирования в моем приложении, которая логирует каждую неуспешную бизнес-итерацию плагина [active_interaction](https://github.com/AaronLasseigne/active_interaction):

```ruby
Rails.logger.info({
  message:    "Не успешная бизнес-итерация",
  event_name: :invalid_interaction,
  interactor: interaction.class.to_s,
  errors:     interaction.errors.messages,
})
```

Теперь передав все эти логи в правильную среду анализа я смогу составить точную (при условии не потери данных при доставке) статистику по каждой не успешной итерации.

Формирование контекста тоже является задачей для программиста, потому что нужно:

— не передавать лишнего
— не спалить персональные данные
— передать достаточно данных для анализа

Проблема в том, что обычно логирование это последнее дело в цикле разработки задачи, поэтому сделать все по-красоте бывает лень, а делать придется постоянно, и во многих случаях вы помогаете только себе, потому что отвечаете за работоспособность приложения. Так что это довольно-таки челленджевый момент. Хотя вся разработка и соблюдение красоты в процессе состоит из таких вот моментов.

Могу только посоветовать логировать сразу и определять контекст сразу же не отходя от кассы, и не оставлять это на потом — будет проще.

## Интерфейс отправки & выбор библиотеки логирования
Стандартный интерфейс Rails-логера выглядит так:

```ruby
Rails.logger.info("Hello Developers!")
```

Не очень хочется уходить от стандарта, и тем более не хочется ломать старую кодовую базу. Благо почти все популярные логеры похожи в плане интерфейса взаимодействия. Проблематика выбора библиотек логирования заключается в следующем:

- Не все библиотеки позволяют создать несколько экземпляров логера
- Не все библиотеки позволяют продублировать поток вывода в дополнительный источник (то есть сразу писать и в stdout и в отдельный файл)

Из-за первого требования я сразу откинул https://github.com/reidmorrison/semantic_logger. Он прекрасен, и у меня даже был опыт с ним в одном из проектов, но он намертво привязан к одному глобальному объекту. Это не совсем подходило мне.

После копаний и изучения возможных вариантов мой выбор пал на [lagstash-logger](https://github.com/dwbutler/logstash-logger). Я максимально пытался найти другое решение, но в итоге сдался и попробовал его. Субъективно говоря меня смущало название "logstash" в имене гема, как-то совсем не хотелось привязываться к logstah'у (это такой ruby-сборщик логов), а хотелось универсального решения, но по итогу я подумал, что это просто название. Есть и другие решения, но это победило за счет гибкости и относительной популярности на гитхабе. Все же мы, люди, смотрим на рейтинге, а популярность на гитхабе обеспечивает хоть какую-то поддержку.

### Берем дополнительные гемы на борт
#### Склейка многострочных логов
Для первичной склейки Rails логов нам пригодится [lograge](https://github.com/roidrage/lograge) — эта штука привращает "10-строчные" лог-события Rails в однострочный лог. 

#### Логирование исходящих http запросов
С помощью [httplog](https://github.com/trusche/httplog) мы сможем логировать все исходящие от нашего приложения http-запросы, а так же их ответы. 

## Установка и настройка решения

#### Gemfile
```ruby
gem 'lograge'
gem 'logstash-logger'
gem 'httplog'
```

#### config/initializers/logstash_logger.rb
Это стартовая точка конфигурации, здесь мы настраиваем поля, которые будут присваиваться каждому логу:
```ruby
LogStashLogger.configure do |config|
  config.customize_event do |event|
    event[:app]    = "MyApplication"
    event[:env]    = Rails.env
    event[:kind] ||= "web"
  end
end
```
При этом поле `:kind` будет переопределено другими процессами нашего сервиса (например воркеры будут иметь `event[:kind] == "workers"` и т.д.

#### Настройка типов вывода логирования в разных окружениях
Теперь самый хитрый момент, где можно напутать. Важно определиться в каком окружении что будет выводиться. Например в development'е нет смысла выводить json логи в stdout, удобнее оставить старый добрый plain формат. В test вообще нет смысла выводить логи в stdout (только в файл), так как stdout тестовый среды занят выводом результатов самих тестов.

С учетом иерархии конфигурации, абстрактно, наш логер будет настроен так:

##### config/application.rb 
Настройка по-умолчанию
- пишет в stdout с обычным форматированием
- пишет в лог-файл в json формате

##### config/production.rb
- пишет в stdout в формате json
- пишет в лог-файл в формате json

##### config/development.rb
- наследует настройку config/application.rb
- если передана переменная окружения `JSON_LOGGER`, то будет логировать не в plain, а в json формате— это полезно только для дебага json логов, чтобы увидеть как будут выглядить ваши json логи в stdout'е запущенного веб-сервера в development окружении. В общем for debug purpose only, can be ignored :)

##### config/test.rb
- не логирует логи в stdout
- пишет в лог-файл в формате json

Перейдем к непосредственной настройке файлов окружений

#### config/application.rb
Далее я буду комментировать прямо внутри примеров кода:

```ruby
# Настраиваем lograge по канонам их readme
config.lograge.enabled = true
config.lograge.base_controller_class = "ActionController::API"

# Лично для себя пока не нашел большой пользы от этой настройки (или не осознал суть)
# Помечаем каждый лог action controller'а уникальным идентификатором:
config.log_tags = [:request_id]

# Пробрасываем кастомные настройки в логи action controller'а через настройки lograge
config.lograge.custom_options = lambda do |event|
  kv = {
    event_name: event.name,               # тип события
    params:     event.payload[:params],   # параметры события
    remote_ip:  event.payload[:remote_ip] # удаленный ip
  }

  # Записываем backtrace исключения, если информация о нем предоставлена в событии:
  if event.payload[:exception]
    kv[:exception]  = event.payload[:exception]
    kv[:stacktrace] = event.payload[:exception_object].backtrace.first(20)
  end

  kv
end

# Пробрасываем информацию из контроллеров в lograge
config.lograge.custom_payload do |controller|
  kv = {}

  # Добавляем email админа в лог
  if controller.respond_to?(:current_user) and (user = controller.current_user)
    kv[:admin_email] = user.email
  end

  kv
end

# Настройка логирования по-умолчанию
logger = LogStashLogger.new({
  type: :multi_logger,
  outputs: [
    # Пишем в stdout используя стандартный формат
    {
      type: :stdout,
      formatter: ::Logger::Formatter,
    },
	
	# Пишем в лог-файл в json формате
    {
      type: :file,
      formatter: :json_lines,
      path: Rails.root.join("log/#{Rails.env}.log"),
      sync: true,
    }
  ]
})

# Переопределяем экземпляр логера всего приложения
config.logger            = logger

# Настройка понятная из названия, не стоит забывать отключать ее в production'е
config.colorize_logging  = true
```

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
config.colorize_logging  = false  # Отключаем цветные лог-сообщения в проде

# Важно не забыть о нашем склеивальщике многострочных логов, ему тоже нужно определять формат вывода
config.lograge.formatter = Lograge::Formatters::Logstash.new
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
Чтобы подружить httplog и logstah-logger пришлось написать небольшой патч который стыкует их интерфейсы. Ну и определить наш собственный формат:

##### config/initializers/http_log.rb
```ruby
class HttpLogFormatter

  class << self

    def call(kv = {})
      hash = {
	  	# Не забываем определить тип события:
        event_name: :http_request,
        message:    "#{kv[:response_code]} #{kv[:method]} #{kv[:url].to_s}",
        duration:   kv[:benchmark],
        context:    {},
      }

      if Rails.env.production?
	  	# Это субъективно, и может совсем не подойти вам:
        # Если мы в проде, и что-то пошло не по плану, то 
		# логируем тело ответа только у неуспешного запроса:
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

# А вот и минимальный патч:
module HttpLog

  class << self
  	# FIXME: logstash multi logger not working with :add method properly (only with info/debug etc)
    def send_to_graylog data
      data.compact!

      config.logger.info(config.graylog_formatter.call(data))
    end
  end
  
end
```

#### config/initializers/sidekiq.rb - настройка sidekiq
Эта часть конфигурации не самая полная, и требует дальнейшей доработки в контексте обогащения данными. Не идеально, но все равно поделюсь:

```ruby
creds = (Settings.redis&.to_hash || {}).merge(namespace: 'myapp')

class MyApplicationSidekiqFormatter

  def self.call(event)
    event[:kind] = 'sidekiq' # Проставляем kind чтобы отличать разные процессы приложений
    event[:pid]  = Process.pid                                # PID процесса
    event[:tid]  = "TID-#{Thread.current.object_id.to_s(36)}" # ID трэда

	# Пробрасываем данные sidekiq джобы в наш лог
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

## Бонус: логируем медленные sql запросы (в том числе в отдельный лог-файл)
Мы будем логировать долгие sql запросы при помощи подписки на события `ActiveSupport::Notifications`. 
Таким образом, взяв этот пример, вы можете создать свои логеры на другие события этого модуля Rails. А их существует очень много. При этом я буду писать все события такого рода в отдельный файл — log/slow_queries.log, чтобы его можно было легко скачать и проанализировать все медленные запросы к базе не занимаясь лишними поисками.

#### lib/slow_query_logger.rb:
Код не идеальный, и мне с ним помог коллега (написав его), ну а я чуть модифицировал под себя:
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

Модуль-детектор готов, теперь его нужно прикрепить к определенным событиям  `ActiveSupport::Notifications`:

#### config/initializers/slow_query_logger.rb:
При этом мы будем логировать событие сразу в два физических файла - в основной лог приложения, и отдельный лог-файл, созданный специально для трейсинга не оптимальностей и тормозов в мире sql'я :)
```ruby
require "slow_query_logger"

# Определяем уровень срабатывания:
threshold = ENV["RAILS_LOG_SLOW_QUERIES_THRESHOLD"] || 350 # ms

# Логер, который будем писать в production.log/development.log/test.log:
rails_query_logger = SlowQueryLogger.new(Rails.logger, threshold: threshold)

# Логер, который будет писать в log/slow_queries.log:
base_file_logger = Logger.new(Rails.root.join("log/slow_queries.log"))
file_query_logger  = SlowQueryLogger.new(base_file_logger, threshold: threshold)

# Прикрепляем наш SlowQueryLogger к стриму событий: 
ActiveSupport::Notifications.subscribe("sql.active_record") do |name, start, finish, id, payload|
  rails_query_logger.call(name, start, finish, id, payload)
  file_query_logger.call(name, start, finish, id, payload)
end
```

## Сбор & анализ логов — не дешевая вещь
В моих последних проектах заказчик и мы вместе с ним идем по пути elk стека:

Хранилище — https://www.elastic.co/elasticsearch/
Сборщик — https://www.elastic.co/logstash/
Среда анализа — https://www.elastic.co/kibana/

Все эти решения красивы, но дороги. Во-первых это java в случае Elasticsearch и ruby в случае сборки логов через Logstash. Сборку логов лучше переводить на golang-based решения, и они есть. 

С Elasticsearch же, хоть мы уже имеем неплохую экспертизу, и создавали и поддерживали базы под несколько десятков миллионов объектов (кажется даже к сотне миллионов) история чуть сложнее. Эластик классный, но не все его функции нужны, особенно в контексте анализа.

Например, полнотекстовый движок в этой задаче можно выхватить. Поиска по полному совпадению или fuzzy-поиска может хватить за глаза в такой задаче. И именно из-за этого можно попробовать (и я буду пробовать) искать другие решения.

Когда я работал в Рокетбанке я перевел часть сервисов, за которые отвечал на clickhouse. Единственное чего мне совсем не хватало - это хорошего ui, на подобии kibana или ui из [graylog](https://www.graylog.org). Может быть к этому времени уже что-то появилось, но если честно я не думаю ... не помню, чтобы кто-то пытался сделать на базе clickhouse log-stream-viewer, все относится к клику скорее как к коробке для построения аналитических отчетов. А жаль. Начав делать [эту штуку](https://github.com/pechorin/ch-logzy) я бросил ее даже не выпустив какой-то mvp, кажется рокетбанк закрылся и у меня появились совсем другие текущие задачи. А на текущей работе кликхаусом для логов пока и не пахнет. Имхо, бери и делай.

Помимо прочего я всегда в поиске легковесной альтерантивы эластика, но думаю решение придет не из этого фронта, потому что все легковестные альтернативы все еще про "генерализированный поиск в разных сценариях". Хотя, признаюсь, решений на базе [lsm деревьев](https://ru.wikipedia.org/wiki/LSM-дерево) и других структур данных сейчас просто море. Откройте гитхаб, введите lsm и начинайте поиск :) Узнаете много нового (и мне тоже стоит вернуться к этой теме).